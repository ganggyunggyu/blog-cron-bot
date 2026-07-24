import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
} from './database';
import { exportSheetAPI } from './cron-pages';
import { logger } from './lib/logger';
import { emitExposureProgress } from './lib/exposure-progress';
import {
  AUTO_KEYWORD_CONCURRENCY,
  parseExposureSuiteOptions,
} from './lib/exposure-suite/options';
import {
  createDistributedRun,
  assertNoActiveDistributedRun,
  finishDistributedRun,
} from './lib/distributed-exposure/run-store';
import { finalizeDistributedPageTarget } from './lib/distributed-exposure/page-finalizer';
import { finalizeDistributedRootTarget } from './lib/distributed-exposure/root-finalizer';
import {
  isDistributedPageTarget,
  prepareDistributedJobs,
} from './lib/distributed-exposure/job-planner';
import { waitForDistributedRun } from './lib/distributed-exposure/run-monitor';
import { getDistributedRunSnapshot } from './lib/distributed-exposure/queue';
import {
  finalizeDistributedCafeNotification,
  finalizeDistributedDirectNotification,
  isDistributedDirectTarget,
} from './lib/distributed-exposure/notification-finalizer';

dotenv.config();

const DEFAULT_TIMEOUT_MINUTES = 30;
const localWorkers = new Set<ChildProcess>();
let stopping = false;

const stopWorker = (): void => {
  stopping = true;
  localWorkers.forEach((worker) => {
    if (!worker.pid) return;
    try {
      if (process.platform !== 'win32') process.kill(-worker.pid, 'SIGTERM');
      else worker.kill('SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  });
};

process.once('SIGINT', stopWorker);
process.once('SIGTERM', stopWorker);

const startLocalWorkers = (runId: string, count: number): void => {
  if (process.env.DISTRIBUTED_EXPOSURE_LOCAL_WORKER === 'false') return;
  const workerEnvironment = { ...process.env };
  delete workerEnvironment.PORT;
  Array.from({ length: count }).forEach(() => {
    const worker = spawn(
      'pnpm',
      ['run', 'exposure:worker', '--', `--run-id=${runId}`],
      {
        cwd: process.cwd(),
        env: workerEnvironment,
        stdio: 'inherit',
        detached: process.platform !== 'win32',
      }
    );
    localWorkers.add(worker);
    worker.once('close', () => localWorkers.delete(worker));
  });
};

const getTimeoutMs = (): number => {
  const value = Number(process.env.DISTRIBUTED_EXPOSURE_TIMEOUT_MINUTES);
  const minutes = Number.isFinite(value) && value >= 5 ? value : DEFAULT_TIMEOUT_MINUTES;
  return minutes * 60_000;
};

const main = async (): Promise<void> => {
  const options = parseExposureSuiteOptions(process.argv.slice(2), process.env);
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');

  const runId = randomUUID();
  const startedAt = Date.now();
  await connectDB(mongoUri);

  try {
    await assertNoActiveDistributedRun();
    const jobs = await prepareDistributedJobs(options.targets);
    await createDistributedRun({
      runId,
      targets: options.targets,
      concurrency: options.concurrency,
      maxPages: options.maxPages,
      jobs,
    });
    options.targets.forEach((target) => emitExposureProgress(target, 0, 1, 'pending'));
    logger.summary.start('다중 워커 노출체크', [
      { label: '실행 ID', value: runId },
      { label: '분산 작업', value: `${jobs.length}개` },
      {
        label: '워커당 병렬',
        value:
          options.concurrency === AUTO_KEYWORD_CONCURRENCY
            ? '원본 유효 키워드 전체'
            : `${options.concurrency}개`,
      },
      { label: '서버 배치', value: '시트당 1개' },
    ]);

    startLocalWorkers(runId, options.targetConcurrency);
    await waitForDistributedRun(runId, getTimeoutMs(), () => stopping);

    const completedSnapshot = await getDistributedRunSnapshot(runId);
    const workerNetworks = new Map<string, string>();
    completedSnapshot.jobs.forEach(({ workerId, egressIp }) => {
      if (!workerId || !egressIp) {
        throw new Error('완료 작업에 워커 또는 외부 IP 기록이 없음');
      }
      const previousIp = workerNetworks.get(workerId);
      if (previousIp && previousIp !== egressIp) {
        throw new Error(`${workerId} 외부 IP가 실행 중 변경됨`);
      }
      workerNetworks.set(workerId, egressIp);
    });
    const workerIps = Array.from(workerNetworks.values());
    if (workerNetworks.size !== completedSnapshot.jobs.length) {
      throw new Error(
        `시트당 전용 워커 불일치: 작업 ${completedSnapshot.jobs.length}개 / 워커 ${workerNetworks.size}개`
      );
    }
    if (new Set(workerIps).size !== workerIps.length) {
      throw new Error('서로 다른 워커가 같은 외부 IP를 사용함');
    }
    logger.info(
      `[다중워커] 외부 IP 분리 확인: ${Array.from(workerNetworks.entries())
        .map(([workerId, egressIp]) => `${workerId}=${egressIp}`)
        .join(', ')}`
    );

    const pageTargets = options.targets.filter(isDistributedPageTarget);
    const elapsedTime = `${Math.floor((Date.now() - startedAt) / 1000)}초`;
    const finalizeFailures: string[] = [];

    const runFinalizeStep = async (
      label: string,
      step: () => Promise<void>
    ): Promise<void> => {
      try {
        await step();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${label} 마무리 실패: ${message}`);
        finalizeFailures.push(`${label}: ${message}`);
      }
    };

    if (options.targets.includes('root')) {
      await runFinalizeStep('루트', () => finalizeDistributedRootTarget(elapsedTime));
    }
    for (const target of pageTargets) {
      await runFinalizeStep(`${target} 내보내기`, () => exportSheetAPI(target));
      await runFinalizeStep(`${target} 결과 반영`, () =>
        finalizeDistributedPageTarget(target, elapsedTime)
      );
    }
    if (pageTargets.length > 0) {
      logger.info('[다중워커] 애견·서리펫 개별 결과 탭 직접 반영 완료');
    }
    for (const target of options.targets.filter(isDistributedDirectTarget)) {
      await runFinalizeStep(target, () =>
        finalizeDistributedDirectNotification(target, elapsedTime)
      );
    }
    if (options.targets.includes('cafe')) {
      await runFinalizeStep('카페', () => finalizeDistributedCafeNotification(elapsedTime));
    }

    if (finalizeFailures.length > 0) {
      throw new Error(
        `일부 대상 마무리 실패 (${finalizeFailures.length}건): ${finalizeFailures.join(' / ')}`
      );
    }

    await finishDistributedRun(runId, 'success');
    logger.summary.complete('다중 워커 노출체크 완료', [
      { label: '성공 대상', value: `${options.targets.length}개` },
      { label: '총 소요', value: `${Math.floor((Date.now() - startedAt) / 1000)}초` },
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishDistributedRun(runId, 'failed', message);
    throw error;
  } finally {
    stopWorker();
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`다중 워커 노출체크 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
