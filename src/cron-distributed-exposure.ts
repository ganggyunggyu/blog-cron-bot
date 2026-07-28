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
import {
  finalizeDistributedPageTarget,
  validateDistributedPageTarget,
} from './lib/distributed-exposure/page-finalizer';
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
import {
  estimateRailwayWorkerCost,
  formatRailwayCost,
} from './lib/distributed-exposure/cost-estimate';

dotenv.config();

const DEFAULT_TIMEOUT_MINUTES = 90;
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
      { label: '서버 배치', value: '시트별 전용 외부 IP' },
    ]);

    startLocalWorkers(runId, options.targetConcurrency);
    const outcome = await waitForDistributedRun(
      runId,
      getTimeoutMs(),
      () => stopping
    );

    if (outcome.unfinishedTargets.length > 0) {
      logger.error(
        `[다중워커] 크롤 미완료 ${outcome.unfinishedTargets.length}개(${outcome.unfinishedTargets.join(', ')}) — ${outcome.failureDetail}`
      );
      logger.info(
        `[다중워커] 성공한 ${outcome.succeededTargets.length}개는 그대로 시트 반영·Dooray를 진행함`
      );
    }

    // 크롤에 성공한 대상만 마무리한다. 실패한 대상의 결과를 시트에 쓰면 이전 값이
    // 빈 값으로 덮여버리므로 반드시 제외해야 한다.
    const succeeded = new Set(outcome.succeededTargets);
    const finalizeTargets = options.targets.filter((target) =>
      succeeded.has(target)
    );

    const completedSnapshot = await getDistributedRunSnapshot(runId);
    // 실패한 작업은 워커/IP 기록이 없을 수 있으므로 성공 작업만 검증한다.
    const successfulJobs = completedSnapshot.jobs.filter(
      ({ status }) => status === 'success'
    );
    const workerNetworks = new Map<string, string>();
    const networkWarnings: string[] = [];
    successfulJobs.forEach(({ target, workerId, egressIp }) => {
      if (!workerId || !egressIp) {
        networkWarnings.push(`${target}: 워커 또는 외부 IP 기록 없음`);
        return;
      }
      const previousIp = workerNetworks.get(workerId);
      if (previousIp && previousIp !== egressIp) {
        networkWarnings.push(`${workerId} 외부 IP가 실행 중 변경됨`);
      }
      workerNetworks.set(workerId, egressIp);
    });
    const workerIps = Array.from(workerNetworks.values());
    if (workerNetworks.size !== successfulJobs.length) {
      networkWarnings.push(
        `시트당 전용 워커 불일치: 작업 ${successfulJobs.length}개 / 워커 ${workerNetworks.size}개`
      );
    }
    if (new Set(workerIps).size !== workerIps.length) {
      networkWarnings.push('서로 다른 워커가 같은 외부 IP를 사용함');
    }

    // IP 분리는 차단 예방용 위생 점검이지 결과 정합성 조건이 아니다. 예전에는 여기서
    // throw해서, 크롤이 멀쩡히 끝난 대상까지 시트 반영과 Dooray가 전부 스킵됐다.
    // 경고로 남기고 마무리는 그대로 진행하되, 최종 보고에는 포함한다.
    if (networkWarnings.length > 0) {
      logger.warn(`[다중워커] 외부 IP 점검 경고: ${networkWarnings.join(' / ')}`);
    }
    logger.info(
      `[다중워커] 외부 IP 분리 확인: ${Array.from(workerNetworks.entries())
        .map(([workerId, egressIp]) => `${workerId}=${egressIp}`)
        .join(', ')}`
    );

    const pageTargets = finalizeTargets.filter(isDistributedPageTarget);
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

    if (finalizeTargets.includes('root')) {
      await runFinalizeStep('루트', () => finalizeDistributedRootTarget(elapsedTime));
    }
    for (const target of pageTargets) {
      await runFinalizeStep(`${target} 결과 반영`, async () => {
        await validateDistributedPageTarget(target);
        await exportSheetAPI(target);
        await finalizeDistributedPageTarget(target, elapsedTime);
      });
    }
    if (pageTargets.length > 0) {
      logger.info('[다중워커] 애견·서리펫 개별 결과 탭 직접 반영 완료');
    }
    for (const target of finalizeTargets.filter(isDistributedDirectTarget)) {
      await runFinalizeStep(target, () =>
        finalizeDistributedDirectNotification(target, elapsedTime)
      );
    }
    if (finalizeTargets.includes('cafe')) {
      await runFinalizeStep('카페', () => finalizeDistributedCafeNotification(elapsedTime));
    }

    const crawlFailure =
      outcome.unfinishedTargets.length > 0
        ? `${outcome.timedOut ? '제한 시간 초과' : '크롤 실패'} ${outcome.unfinishedTargets.length}개(${outcome.unfinishedTargets.join(', ')}) — ${outcome.failureDetail}`
        : '';

    if (crawlFailure || finalizeFailures.length > 0) {
      const reasons = [
        ...(crawlFailure ? [crawlFailure] : []),
        ...(finalizeFailures.length > 0
          ? [`마무리 실패 ${finalizeFailures.length}건: ${finalizeFailures.join(' / ')}`]
          : []),
        ...(networkWarnings.length > 0
          ? [`외부 IP 점검 경고: ${networkWarnings.join(' / ')}`]
          : []),
      ];
      logger.info(
        `[다중워커] 반영 완료 ${finalizeTargets.length - finalizeFailures.length}개 / 전체 ${options.targets.length}개`
      );
      throw new Error(reasons.join(' | '));
    }

    await finishDistributedRun(runId, 'success');
    const elapsedMs = Date.now() - startedAt;
    const costEstimate = estimateRailwayWorkerCost(
      workerNetworks.size,
      elapsedMs
    );
    logger.summary.complete('다중 워커 노출체크 완료', [
      { label: '성공 대상', value: `${options.targets.length}개` },
      { label: '총 소요', value: `${Math.floor(elapsedMs / 1000)}초` },
      {
        label: '이번 실행 서버비 추정',
        value: formatRailwayCost(costEstimate.runUsd, costEstimate.runKrw),
      },
      {
        label: '30일 상시 운영 추정',
        value: formatRailwayCost(
          costEstimate.monthlyUsd,
          costEstimate.monthlyKrw
        ),
      },
      {
        label: '비용 가정',
        value: `${costEstimate.workerCount}워커 · ${costEstimate.vcpu} vCPU · ${costEstimate.memoryGb}GB`,
      },
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
