import { spawn, type ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import { logger } from './lib/logger';
import {
  ExposureTargetId,
  ExposureTargetJob,
  buildTargetEnvironment,
  parseExposureSuiteOptions,
  planExposureTargetJobs,
} from './lib/exposure-suite/options';
import {
  acquireRunLock,
  type RunLock,
} from './lib/exposure-suite/run-lock';
import {
  startRequestBroker,
  type RequestBroker,
} from './lib/exposure-suite/request-broker';
import { waitForRecoveryDelay } from './lib/exposure-suite/recovery-delay';
import { emitExposureProgress } from './lib/exposure-progress';

dotenv.config();

const TARGET_LABELS: Record<ExposureTargetId, string> = {
  package: '패키지',
  general: '일반건',
  dogmaru: '도그마루',
  root: '루트',
  pet: '애견',
  suripet: '서리펫',
  cafe: '카페',
};

const TARGET_PRIORITY: Record<ExposureTargetId, number> = {
  cafe: 0,
  pet: 1,
  suripet: 2,
  root: 3,
  package: 4,
  general: 5,
  dogmaru: 6,
};

const activeChildren = new Set<ChildProcess>();
let isStopping = false;
let activeSuiteLock: RunLock | undefined;
let recoveryDelayController: AbortController | undefined;

const releaseSuiteLock = (): void => {
  activeSuiteLock?.release();
  activeSuiteLock = undefined;
};

const stopChildProcessGroup = (child: ChildProcess): void => {
  if (child.pid === undefined) return;

  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, 'SIGTERM');
      return;
    }
    child.kill('SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
};

const stopChildren = (): void => {
  isStopping = true;
  recoveryDelayController?.abort();
  activeChildren.forEach(stopChildProcessGroup);
};

process.once('SIGINT', stopChildren);
process.once('SIGTERM', stopChildren);
process.once('exit', releaseSuiteLock);

const runTarget = async (
  job: ExposureTargetJob,
  concurrency: number,
  maxPages: number,
  brokerEnvironment: NodeJS.ProcessEnv,
  isRecoveryRun = false
): Promise<void> => {
  const { command, targets } = job;
  const label = targets.map((target) => TARGET_LABELS[target]).join(' + ');
  const effectiveMaxPages = targets.some(
    (target) => target === 'pet' || target === 'suripet'
  )
    ? maxPages
    : 1;

  logger.info(
    `▶ ${label} 시작 (병렬 ${concurrency}, 최대 ${effectiveMaxPages}페이지)`
  );
  targets.forEach((target) => emitExposureProgress(target, 0, 0, 'running'));

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        'run',
        command.script,
        ...command.args,
      ],
      {
        cwd: process.cwd(),
        stdio: 'inherit',
        detached: process.platform !== 'win32',
        env: {
          ...buildTargetEnvironment(
            process.env,
            targets,
            concurrency,
            maxPages
          ),
          FAST_EXPOSURE_MODE: isRecoveryRun ? 'false' : 'true',
          ...brokerEnvironment,
        },
      }
    );

    activeChildren.add(child);
    child.once('error', (error) => {
      activeChildren.delete(child);
      reject(error);
    });
    child.once('close', (code) => {
      activeChildren.delete(child);
      if (code === 0) {
        targets.forEach((target) => emitExposureProgress(target, 0, 0, 'success'));
        logger.success(`✓ ${label} 완료`);
        resolve();
        return;
      }
      reject(new Error(`${label} 종료 코드 ${code ?? 'unknown'}`));
    });
  });
};

const main = async (): Promise<void> => {
  const suiteLock = acquireRunLock(
    `${process.cwd()}/work/exposure-suite.lock`
  );
  activeSuiteLock = suiteLock;
  let requestBroker: RequestBroker | undefined;

  try {
    const options = parseExposureSuiteOptions(
      process.argv.slice(2),
      process.env
    );
    const targetJobs = planExposureTargetJobs(options.targets);
    const workerCount = Math.min(
      options.targetConcurrency,
      options.concurrency,
      targetJobs.length
    );
    const workerConcurrency = Array.from(
      { length: workerCount },
      () => options.concurrency
    );
    const scheduledJobs = [...targetJobs].sort(
      (left, right) =>
        Math.min(...left.targets.map((target) => TARGET_PRIORITY[target])) -
        Math.min(...right.targets.map((target) => TARGET_PRIORITY[target]))
    );
    const failures: Array<{
      job: ExposureTargetJob;
      label: string;
      message: string;
    }> = [];
    let nextTargetIndex = 0;
    const broker = await startRequestBroker(options.concurrency);
    requestBroker = broker;

    options.targets.forEach((target) =>
      emitExposureProgress(target, 0, 0, 'pending')
    );

    logger.summary.start('전체 빠른 노출체크', [
      {
        label: '대상',
        value: options.targets
          .map((target) => TARGET_LABELS[target])
          .join(', '),
      },
      { label: '대상별 병렬', value: `${options.concurrency}` },
      { label: '동시 대상', value: `${workerCount}` },
      {
        label: '최대 동시 요청',
        value: `${options.concurrency}`,
      },
      {
        label: '애견·서리펫 최대 페이지',
        value: `${options.maxPages}`,
      },
    ]);

    const worker = async (concurrency: number): Promise<void> => {
      while (!isStopping && nextTargetIndex < scheduledJobs.length) {
        const targetIndex = nextTargetIndex;
        nextTargetIndex += 1;
        const job = scheduledJobs[targetIndex];
        const label = job.targets
          .map((target) => TARGET_LABELS[target])
          .join(' + ');

        try {
          await runTarget(
            job,
            concurrency,
            options.maxPages,
            broker.environment
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          failures.push({ job, label, message });
          job.targets.forEach((target) =>
            emitExposureProgress(target, 0, 0, 'failed')
          );
          logger.error(`${label} 실패: ${message}`);
        }
      }
    };

    await Promise.all(
      workerConcurrency.map((concurrency) => worker(concurrency))
    );

    if (isStopping) {
      throw new Error('사용자 요청으로 실행 중지');
    }

    const retryFailures: Array<{ label: string; message: string }> = [];
    if (failures.length > 0) {
      logger.warn(
        `일시 실패 ${failures.length}개 대상은 65초 차단 해제 대기 후 병렬 1로 순차 재실행합니다.`
      );
      recoveryDelayController = new AbortController();
      try {
        await waitForRecoveryDelay(65_000, recoveryDelayController.signal);
      } finally {
        recoveryDelayController = undefined;
      }

      for (const { job, label } of failures) {
        if (isStopping) break;
        try {
          await runTarget(job, 1, options.maxPages, broker.environment, true);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          retryFailures.push({ label, message });
          job.targets.forEach((target) =>
            emitExposureProgress(target, 0, 0, 'failed')
          );
          logger.error(`${label} 저속 재실행 실패: ${message}`);
        }
      }
    }

    if (isStopping) {
      throw new Error('사용자 요청으로 실행 중지');
    }

    if (retryFailures.length > 0) {
      throw new Error(
        retryFailures
          .map(({ label, message }) => `${label}=${message}`)
          .join(', ')
      );
    }

    logger.summary.complete('전체 빠른 노출체크 완료', [
      { label: '성공 대상', value: `${options.targets.length}개` },
    ]);
  } finally {
    try {
      await requestBroker?.close();
    } finally {
      suiteLock.release();
      if (activeSuiteLock === suiteLock) activeSuiteLock = undefined;
    }
  }
};

main().catch((error) => {
  stopChildren();
  logger.error(`전체 빠른 노출체크 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
