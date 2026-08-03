import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import { sleep } from '@ganggyunggyu/shared';
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
import { finalizeDistributedOldLogicMore } from './lib/distributed-exposure/more-finalizer';
import {
  MORE_TARGET_LABELS,
  parseMoreTargets,
  type MoreTarget,
} from './lib/distributed-exposure/more-targets';

dotenv.config();

const TARGETS = parseMoreTargets(process.argv.slice(2));
const DEFAULT_TIMEOUT_MINUTES = 90;
const SHEETS_QUOTA_RETRY_DELAY_MS = 65_000;
const MAX_SHEETS_QUOTA_MERGE_ATTEMPTS = 3;
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

const runMerge = (target: MoreTarget, titles: string[]): Promise<void> =>
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
      { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let output = '';
    const forwardOutput = (chunk: Buffer): void => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    };
    child.stdout?.on('data', forwardOutput);
    child.stderr?.on('data', forwardOutput);
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${target} 더보기 결과 병합 종료 코드 ${code ?? 'unknown'}: ${output.slice(-2000)}`
          )
        );
    });
  });

const runMergeWithRetry = async (
  target: MoreTarget,
  titles: string[]
): Promise<void> => {
  for (let attempt = 1; attempt <= MAX_SHEETS_QUOTA_MERGE_ATTEMPTS; attempt += 1) {
    try {
      await runMerge(target, titles);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canRetry = /quota exceeded|\b429\b/i.test(message);
      if (!canRetry || attempt === MAX_SHEETS_QUOTA_MERGE_ATTEMPTS) throw error;
      logger.warn(
        `[더보기 다중워커] ${target} 병합 Sheets 쿼터 초과, ` +
          `${SHEETS_QUOTA_RETRY_DELAY_MS / 1000}초 후 재시도 (${attempt}/${MAX_SHEETS_QUOTA_MERGE_ATTEMPTS})`
      );
      await sleep(SHEETS_QUOTA_RETRY_DELAY_MS);
    }
  }
};

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
    logger.summary.start('더보기 다중 워커 노출체크', [
      { label: '실행 ID', value: runId },
      { label: '대상', value: TARGETS.map((target) => MORE_TARGET_LABELS[target]).join(' · ') },
      { label: '분산 작업', value: `${jobs.length}개` },
      { label: '조각 기준', value: '대상별 상시 워커 수만큼, 워커당 순차 1개' },
    ]);

    startLocalWorker(runId);
    const outcome = await waitForDistributedRun(runId, getTimeoutMs(), () => stopping);
    if (outcome.unfinishedTargets.length > 0) {
      throw new Error(
        `더보기 크롤 미완료 ${outcome.unfinishedTargets.join(', ')} — ${outcome.failureDetail}`
      );
    }

    const snapshot = await getDistributedRunSnapshot(runId);
    const elapsedTime = `${Math.floor((Date.now() - startedAt) / 1000)}초`;
    for (const target of TARGETS) {
      const titles = snapshot.jobs
        .filter((job) => job.target === target)
        .sort((left, right) => left.shardIndex - right.shardIndex)
        .map((job) => getWorkerOutputTitle(runId, target, job.shardIndex));
      await runMergeWithRetry(target, titles);
      const exported = await finalizeDistributedOldLogicMore(target, elapsedTime);
      logger.info(
        `[더보기 다중워커] ${target} 내보내기 ${exported.resultRows}행 / ` +
          `노출 ${exported.exposedKeywords}/${exported.totalKeywords} / ${exported.csvPath}`
      );
    }

    await finishDistributedRun(runId, 'success');
    const workerNetworks = new Map<string, string>();
    snapshot.jobs.forEach(({ workerId, egressIp }) => {
      if (workerId && egressIp) workerNetworks.set(workerId, egressIp);
    });
    const elapsedMs = Date.now() - startedAt;
    const costEstimate = estimateRailwayWorkerCost(workerNetworks.size, elapsedMs);
    logger.summary.complete('더보기 다중 워커 노출체크 완료', [
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
