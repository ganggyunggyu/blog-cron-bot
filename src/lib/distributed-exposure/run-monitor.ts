import { emitExposureProgress } from '../exposure-progress';
import { logger } from '../logger';
import { getDistributedRunSnapshot } from './queue';

const POLL_MS = 1_000;

export const waitForDistributedRun = async (
  runId: string,
  timeoutMs: number,
  shouldStop: () => boolean
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let previous = '';

  while (!shouldStop() && Date.now() < deadline) {
    const snapshot = await getDistributedRunSnapshot(runId);
    const signature = JSON.stringify(snapshot.jobs);
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
    if (snapshot.failed > 0) throw new Error(`${snapshot.failed}개 작업 최종 실패`);
    if (snapshot.total > 0 && snapshot.success === snapshot.total) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  if (shouldStop()) throw new Error('사용자 요청으로 실행 중지');
  throw new Error(`${Math.floor(timeoutMs / 60_000)}분 제한 시간 초과`);
};
