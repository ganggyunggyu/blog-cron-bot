import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from './database';
import { logger } from './lib/logger';
import {
  assertNoActiveDistributedRun,
  createDistributedRun,
  finishDistributedRun,
} from './lib/distributed-exposure/run-store';
import {
  OLD_LOGIC_MORE_OUTPUT_TITLES,
  prepareDistributedOldLogicMoreJobs,
} from './lib/distributed-exposure/job-planner';
import { waitForDistributedRun } from './lib/distributed-exposure/run-monitor';
import { getDistributedRunSnapshot } from './lib/distributed-exposure/queue';
import {
  estimateRailwayWorkerCost,
  formatRailwayCost,
} from './lib/distributed-exposure/cost-estimate';

dotenv.config();

const TARGETS = ['package', 'general', 'dogmaru'] as const;
const DEFAULT_TIMEOUT_MINUTES = 90;
const localWorkers = new Set<ChildProcess>();
let stopping = false;

const stopWorkers = (): void => {
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

process.once('SIGINT', stopWorkers);
process.once('SIGTERM', stopWorkers);

const startLocalWorker = (runId: string): void => {
  if (process.env.DISTRIBUTED_EXPOSURE_LOCAL_WORKER === 'false') return;
  const environment = { ...process.env };
  delete environment.PORT;
  const worker = spawn('pnpm', ['run', 'exposure:worker', '--', `--run-id=${runId}`], {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  localWorkers.add(worker);
  worker.once('close', () => localWorkers.delete(worker));
};

const getTimeoutMs = (): number => {
  const minutes = Number(process.env.DISTRIBUTED_EXPOSURE_TIMEOUT_MINUTES);
  return (Number.isFinite(minutes) && minutes >= 5 ? minutes : DEFAULT_TIMEOUT_MINUTES) * 60_000;
};

const getWorkerOutputTitle = (runId: string, target: string, shardIndex: number): string =>
  `__more_${runId}_${target}_${shardIndex}`;

const runMerge = (target: (typeof TARGETS)[number], titles: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        'run',
        'old-logic:more-check',
        '--',
        '--output-title',
        OLD_LOGIC_MORE_OUTPUT_TITLES[target],
        '--merge-output-titles',
        titles.join(','),
        '--cleanup-merged-output',
      ],
      { cwd: process.cwd(), env: process.env, stdio: 'inherit' }
    );
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${target} 더보기 결과 병합 종료 코드 ${code ?? 'unknown'}`));
    });
  });

const main = async (): Promise<void> => {
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  const runId = randomUUID();
  const startedAt = Date.now();
  await connectDB(mongoUri);

  try {
    await assertNoActiveDistributedRun();
    const jobs = await prepareDistributedOldLogicMoreJobs([...TARGETS]);
    await createDistributedRun({
      runId,
      targets: [...TARGETS],
      concurrency: 1,
      maxPages: 1,
      jobs,
    });
    logger.summary.start('더보기 30개 원격 워커 노출체크', [
      { label: '실행 ID', value: runId },
      { label: '대상', value: '패키지 · 일반건 · 도그마루' },
      { label: '분산 작업', value: `${jobs.length}개` },
      { label: '조각 기준', value: '대상별 최대 30개, 워커당 순차 1개' },
    ]);

    startLocalWorker(runId);
    const outcome = await waitForDistributedRun(runId, getTimeoutMs(), () => stopping);
    if (outcome.unfinishedTargets.length > 0) {
      throw new Error(
        `더보기 크롤 미완료 ${outcome.unfinishedTargets.join(', ')} — ${outcome.failureDetail}`
      );
    }

    const snapshot = await getDistributedRunSnapshot(runId);
    for (const target of TARGETS) {
      const titles = snapshot.jobs
        .filter((job) => job.target === target)
        .sort((left, right) => left.shardIndex - right.shardIndex)
        .map((job) => getWorkerOutputTitle(runId, target, job.shardIndex));
      await runMerge(target, titles);
    }

    await finishDistributedRun(runId, 'success');
    const workerNetworks = new Map<string, string>();
    snapshot.jobs.forEach(({ workerId, egressIp }) => {
      if (workerId && egressIp) workerNetworks.set(workerId, egressIp);
    });
    const elapsedMs = Date.now() - startedAt;
    const costEstimate = estimateRailwayWorkerCost(workerNetworks.size, elapsedMs);
    logger.summary.complete('더보기 30개 원격 워커 노출체크 완료', [
      { label: '총 소요', value: `${Math.floor(elapsedMs / 1000)}초` },
      { label: '완료 작업', value: `${snapshot.success}/${snapshot.total}` },
      { label: '원격 워커', value: `${workerNetworks.size}개` },
      { label: '이번 실행 사용량 추정', value: formatRailwayCost(costEstimate.runUsd, costEstimate.runKrw) },
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishDistributedRun(runId, 'failed', message);
    throw error;
  } finally {
    stopWorkers();
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`더보기 다중 워커 노출체크 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
