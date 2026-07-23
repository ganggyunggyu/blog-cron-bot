const DEFAULT_WORKER_JOB_CONCURRENCY = 1;
const MAX_WORKER_JOB_CONCURRENCY = 3;

export const getWorkerJobConcurrency = (
  rawValue: string | undefined
): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_WORKER_JOB_CONCURRENCY;
  }

  return Math.min(Math.floor(parsed), MAX_WORKER_JOB_CONCURRENCY);
};
