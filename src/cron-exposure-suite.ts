import { spawn, type ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import { logger } from './lib/logger';
import {
  ExposureTargetId,
  parseExposureSuiteOptions,
  resolveTargetCommand,
} from './lib/exposure-suite/options';
import { acquireRunLock } from './lib/exposure-suite/run-lock';

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
  activeChildren.forEach(stopChildProcessGroup);
};

process.once('SIGINT', stopChildren);
process.once('SIGTERM', stopChildren);

const runTarget = async (
  target: ExposureTargetId,
  concurrency: number,
  maxPages: number
): Promise<void> => {
  const command = resolveTargetCommand(target);
  const label = TARGET_LABELS[target];

  logger.info(
    `▶ ${label} 시작 (병렬 ${concurrency}, 최대 ${maxPages}페이지)`
  );

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
          ...process.env,
          EXPOSURE_CONCURRENCY: String(concurrency),
          PAGE_CHECK_CONCURRENCY: String(concurrency),
          CHECK_CONCURRENCY: String(concurrency),
          CAFE_CHECK_CONCURRENCY: String(concurrency),
          FAST_EXPOSURE_MODE: 'true',
          EXPOSURE_MAX_PAGES: String(maxPages),
          PAGE_CHECK_MAX_PAGES: String(maxPages),
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

  try {
    const options = parseExposureSuiteOptions(
      process.argv.slice(2),
      process.env
    );
    const workerCount = Math.min(
      options.targetConcurrency,
      options.concurrency,
      options.targets.length
    );
    const workerConcurrency = Array.from(
      { length: workerCount },
      () => options.concurrency
    );
    const scheduledTargets = [...options.targets].sort(
      (left, right) => TARGET_PRIORITY[left] - TARGET_PRIORITY[right]
    );
    const failures: Array<{ target: ExposureTargetId; message: string }> = [];
    let nextTargetIndex = 0;

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
        value: `${options.concurrency * workerCount}`,
      },
      { label: '최대 페이지', value: `${options.maxPages}` },
    ]);

    const worker = async (concurrency: number): Promise<void> => {
      while (!isStopping && nextTargetIndex < scheduledTargets.length) {
        const targetIndex = nextTargetIndex;
        nextTargetIndex += 1;
        const target = scheduledTargets[targetIndex];

        try {
          await runTarget(target, concurrency, options.maxPages);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          failures.push({ target, message });
          logger.error(`${TARGET_LABELS[target]} 실패: ${message}`);
        }
      }
    };

    await Promise.all(
      workerConcurrency.map((concurrency) => worker(concurrency))
    );

    if (isStopping) {
      throw new Error('사용자 요청으로 실행 중지');
    }

    if (failures.length > 0) {
      throw new Error(
        failures
          .map(({ target, message }) => `${TARGET_LABELS[target]}=${message}`)
          .join(', ')
      );
    }

    logger.summary.complete('전체 빠른 노출체크 완료', [
      { label: '성공 대상', value: `${options.targets.length}개` },
    ]);
  } finally {
    suiteLock.release();
  }
};

main().catch((error) => {
  stopChildren();
  logger.error(`전체 빠른 노출체크 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
