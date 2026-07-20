import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
} from './database';
import {
  exportAllSheetsAPI,
  exportSheetAPI,
} from './cron-pages';
import { logger } from './lib/logger';
import { emitExposureProgress } from './lib/exposure-progress';
import { parseExposureSuiteOptions } from './lib/exposure-suite/options';
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
  Array.from({ length: count }).forEach(() => {
    const worker = spawn(
      'pnpm',
      ['run', 'exposure:worker', '--', `--run-id=${runId}`],
      {
        cwd: process.cwd(),
        env: process.env,
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
      { label: '워커당 병렬', value: `${options.concurrency}개` },
      { label: '키워드 묶음', value: '50개' },
    ]);

    startLocalWorkers(runId, options.targetConcurrency);
    await waitForDistributedRun(runId, getTimeoutMs(), () => stopping);

    const pageTargets = options.targets.filter(isDistributedPageTarget);
    const elapsedTime = `${Math.floor((Date.now() - startedAt) / 1000)}초`;
    if (options.targets.includes('root')) {
      await finalizeDistributedRootTarget(elapsedTime);
    }
    for (const target of pageTargets) {
      await exportSheetAPI(target);
      await finalizeDistributedPageTarget(target, elapsedTime);
    }
    if (pageTargets.length > 0) {
      logger.info('[다중워커] 페이지 종합 결과를 마지막에 한 번만 반영');
      await exportAllSheetsAPI();
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
