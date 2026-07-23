import type { ChildProcess } from 'node:child_process';
import type { IDistributedExposureJob } from './models';
import {
  completeDistributedJob,
  failDistributedJob,
  heartbeatDistributedJob,
  recordDistributedJobWorker,
} from './queue';
import { logger } from '../logger';
import { getWorkerEgressIp } from './worker-egress-ip';
import { getUncheckedPageKeywordIds } from '../../database';
import { runWorkerChild, stopWorkerChild } from './worker-child';

const HEARTBEAT_MS = 15_000;

export type DistributedJobOutcome = 'success' | 'retry' | 'failed';

export const executeDistributedJob = async (
  job: IDistributedExposureJob,
  workerId: string,
  onChild: (child: ChildProcess | undefined) => void
): Promise<DistributedJobOutcome> => {
  const jobId = String(job._id);
  let currentChild: ChildProcess | undefined;
  const trackChild = (child: ChildProcess | undefined): void => {
    currentChild = child;
    onChild(child);
  };
  const heartbeat = setInterval(() => {
    void heartbeatDistributedJob(jobId, workerId)
      .then((active) => {
        if (active || !currentChild) return;
        logger.warn(`[다중워커] 비활성 작업 종료: ${job.target}`);
        stopWorkerChild(currentChild);
      })
      .catch((error) => {
        logger.error(`[다중워커] heartbeat 실패: ${(error as Error).message}`);
      });
  }, HEARTBEAT_MS);
  heartbeat.unref();

  try {
    const egressIp = await getWorkerEgressIp();
    await recordDistributedJobWorker(jobId, workerId, egressIp);
    logger.info(
      `[다중워커] ${workerId} (${egressIp}) → ${job.target} 시작 ` +
        `(${job.attempts}/${job.maxAttempts})`
    );
    await runWorkerChild(job, trackChild);
    await completeDistributedJob(jobId, workerId);
    logger.success(`[다중워커] ${job.target} 완료`);
    return 'success';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canResumePageShard =
      job.startedAt &&
      job.keywordIds.length > 0 &&
      (job.target === 'pet' || job.target === 'suripet');
    let retryKeywordIds: string[] | undefined;
    if (canResumePageShard) {
      retryKeywordIds = await getUncheckedPageKeywordIds(
        job.target as 'pet' | 'suripet',
        job.keywordIds,
        job.startedAt as Date
      );
      if (retryKeywordIds.length === 0) {
        await completeDistributedJob(jobId, workerId);
        logger.warn(
          `[다중워커] ${job.target} 종료 오류 후 완료 결과 ${job.keywordIds.length}개 유지`
        );
        return 'success';
      }
      logger.warn(
        `[다중워커] ${job.target} 미완료 ${retryKeywordIds.length}/${job.keywordIds.length}개만 재시도`
      );
    }
    const shouldRetry = await failDistributedJob(
      job,
      workerId,
      message,
      retryKeywordIds
    );
    logger.error(`[다중워커] ${job.target} 실패: ${message}`);
    return shouldRetry ? 'retry' : 'failed';
  } finally {
    clearInterval(heartbeat);
  }
};
