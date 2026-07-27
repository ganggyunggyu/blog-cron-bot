import { emitExposureProgress } from '../exposure-progress';
import { logger } from '../logger';
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

export const waitForDistributedRun = async (
  runId: string,
  timeoutMs: number,
  shouldStop: () => boolean
): Promise<void> => {
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
    if (snapshot.failed > 0) {
      throw new Error(
        `${snapshot.failed}개 작업 최종 실패 — ${describeUnfinishedJobs(snapshot)}`
      );
    }
    if (snapshot.total > 0 && snapshot.success === snapshot.total) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  if (shouldStop()) throw new Error('사용자 요청으로 실행 중지');

  const detail = lastSnapshot ? describeUnfinishedJobs(lastSnapshot) : '';
  throw new Error(
    `${Math.floor(timeoutMs / 60_000)}분 제한 시간 초과${detail ? ` — ${detail}` : ''}`
  );
};
