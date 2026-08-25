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
import {
  getUncheckedPageKeywordIds,
  getUncheckedRootKeywordIds,
} from '../../database';
import { runWorkerChild, stopWorkerChild } from './worker-child';

const HEARTBEAT_MS = 15_000;

export type DistributedJobOutcome = 'success' | 'retry' | 'failed';

export const getUncheckedDistributedKeywordIds = (
  job: IDistributedExposureJob
): Promise<string[]> | undefined => {
  // 더보기(old-logic-more)는 결과를 구글시트 워커 탭에만 쓰고 RootKeyword.lastChecked나
  // 페이지 체크 컬렉션의 updatedAt은 건드리지 않는다. 그 값을 검사하는 이 가드는 기본
  // 노출체크가 Mongo에 직접 쓰는 경우만을 위한 것이라, 더보기에 그대로 적용하면 크롤이
  // 끝나도 항상 "갱신 누락"으로 판정돼 같은 조각을 재시도 한도까지 영원히 반복한다.
  // (루트 더보기가 90분 내내 0/10에서 안 움직인 원인이 이것이었다.)
  //
  // 그래서 old-logic-more만 빼는 게 아니라 standard가 아닌 종류는 전부 뺀다.
  // 새 종류를 추가할 때 이 줄을 같이 고쳐야 한다는 걸 기억해야만 안전하다면,
  // 언젠가 똑같은 사고가 다시 난다.
  if (job.jobKind !== 'standard') return undefined;
  if (!job.startedAt || job.keywordIds.length === 0) return undefined;
  if (job.target === 'root') {
    return getUncheckedRootKeywordIds(
      job.keywordIds,
      job.startedAt as Date
    );
  }
  if (job.target === 'pet' || job.target === 'suripet') {
    return getUncheckedPageKeywordIds(
      job.target,
      job.keywordIds,
      job.startedAt as Date
    );
  }
  return undefined;
};

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
    const uncheckedKeywordIds =
      await getUncheckedDistributedKeywordIds(job);
    if (uncheckedKeywordIds) {
      if (uncheckedKeywordIds.length > 0) {
        throw new Error(
          `${job.target} 실제 갱신 누락: ` +
            `${uncheckedKeywordIds.length}/${job.keywordIds.length}개`
        );
      }
    }
    await completeDistributedJob(jobId, workerId);
    logger.success(`[다중워커] ${job.target} 완료`);
    return 'success';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let retryKeywordIds: string[] | undefined;
    const uncheckedKeywordIds =
      await getUncheckedDistributedKeywordIds(job);
    if (uncheckedKeywordIds) {
      retryKeywordIds = uncheckedKeywordIds;
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
