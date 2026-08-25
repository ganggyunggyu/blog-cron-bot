import { sleep } from '@ganggyunggyu/shared';
import { emitExposureProgress } from '../exposure-progress';
import { logger } from '../logger';
import type { ExposureTargetId } from '../exposure-suite/options';
import type { DistributedTargetId } from './adhoc-targets';
import { getDistributedRunSnapshot, type DistributedRunSnapshot } from './queue';

const POLL_MS = 1_000;
const ERROR_PREVIEW_LENGTH = 200;

const previewError = (error?: string): string => {
  const normalized = String(error ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '기록된 오류 없음';
  return normalized.length > ERROR_PREVIEW_LENGTH
    ? `${normalized.slice(0, ERROR_PREVIEW_LENGTH)}…`
    : normalized;
};

/**
 * 실패/시간초과 원인을 한 줄로 요약한다.
 *
 * 예전에는 "N분 제한 시간 초과"만 남아서 어느 대상이 왜 막혔는지 로그로 알 수 없었다.
 * 재시도 횟수와 남은 키워드 수까지 같이 남겨야 "계속 재시도하다 예산을 태운 것"인지
 * "한 번에 죽은 것"인지 구분할 수 있다.
 */
export const describeUnfinishedJobs = (
  snapshot: DistributedRunSnapshot
): string =>
  snapshot.jobs
    .filter(({ status }) => status !== 'success')
    .map(
      ({ target, status, attempts, maxAttempts, remainingKeywords, error }) =>
        `${target}(${status}, 시도 ${attempts}/${maxAttempts}, 남은 키워드 ${remainingKeywords}개): ${previewError(error)}`
    )
    .join(' / ');

export interface DistributedRunOutcome {
  /** 크롤이 끝까지 성공한 대상. 이 대상만 시트 반영·Dooray를 진행한다. */
  succeededTargets: DistributedTargetId[];
  /** 실패했거나 시간 안에 못 끝낸 대상. */
  unfinishedTargets: DistributedTargetId[];
  /** 실패 사유 한 줄 요약. 성공이면 빈 문자열. */
  failureDetail: string;
  timedOut: boolean;
}

export const summarizeOutcome = (
  snapshot: DistributedRunSnapshot | undefined,
  timedOut: boolean
): DistributedRunOutcome => {
  const jobs = snapshot?.jobs ?? [];
  const targets = Array.from(new Set(jobs.map(({ target }) => target)));
  const succeededTargets = targets.filter((target) =>
    jobs
      .filter((job) => job.target === target)
      .every(({ status }) => status === 'success')
  );
  const unfinishedTargets = targets.filter(
    (target) => !succeededTargets.includes(target)
  );

  return {
    succeededTargets,
    unfinishedTargets,
    failureDetail:
      unfinishedTargets.length > 0 && snapshot
        ? describeUnfinishedJobs(snapshot)
        : '',
    timedOut,
  };
};

/**
 * 모든 작업이 결판날 때까지(성공/실패) 기다린 뒤 결과를 반환한다.
 *
 * 예전에는 한 대상이 실패하는 즉시 throw해서, 이미 크롤을 끝낸 나머지 대상까지
 * 시트 반영과 Dooray가 통째로 스킵됐다. 부분 실패는 예외가 아니라 반환값으로 넘겨서
 * 성공한 대상만이라도 끝까지 내보내도록 한다. 중단 요청만 예외로 처리한다.
 */
export const waitForDistributedRun = async (
  runId: string,
  timeoutMs: number,
  shouldStop: () => boolean
): Promise<DistributedRunOutcome> => {
  const deadline = Date.now() + timeoutMs;
  let previous = '';
  let lastSnapshot: DistributedRunSnapshot | undefined;

  while (!shouldStop() && Date.now() < deadline) {
    const snapshot = await getDistributedRunSnapshot(runId);
    lastSnapshot = snapshot;
    const signature = JSON.stringify(
      snapshot.jobs.map(({ target, status }) => `${target}:${status}`)
    );
    if (signature !== previous) {
      previous = signature;
      const targets = Array.from(
        new Set(snapshot.jobs.map(({ target }) => target))
      );
      targets.forEach((target) => {
        const targetJobs = snapshot.jobs.filter((job) => job.target === target);
        const success = targetJobs.filter(
          ({ status }) => status === 'success'
        ).length;
        const hasFailed = targetJobs.some(({ status }) => status === 'failed');
        const hasRunning = targetJobs.some(({ status }) => status === 'running');
        emitExposureProgress(
          target,
          success,
          targetJobs.length,
          hasFailed
            ? 'failed'
            : success === targetJobs.length
              ? 'success'
              : hasRunning
                ? 'running'
                : 'pending'
        );
      });
      logger.info(
        `[다중워커] 완료 ${snapshot.success}/${snapshot.total} · 실행 ${snapshot.running} · 대기 ${snapshot.pending}`
      );
    }
    // 모든 작업이 성공/실패로 결판났으면 더 기다릴 이유가 없다. 실패가 섞여 있어도
    // throw하지 않고 결과로 넘겨서, 성공한 대상은 시트 반영과 Dooray를 받게 한다.
    if (snapshot.total > 0 && snapshot.success + snapshot.failed === snapshot.total) {
      return summarizeOutcome(snapshot, false);
    }
    await sleep(POLL_MS);
  }

  if (shouldStop()) throw new Error('사용자 요청으로 실행 중지');

  return summarizeOutcome(lastSnapshot, true);
};
