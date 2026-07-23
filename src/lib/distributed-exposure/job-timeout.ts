const DEFAULT_JOB_TIMEOUT_MINUTES = 10;

export const getDistributedJobTimeoutMs = (
  value = process.env.DISTRIBUTED_EXPOSURE_JOB_TIMEOUT_MINUTES
): number => {
  const minutes = Number(value);
  const normalized =
    Number.isFinite(minutes) && minutes >= 1
      ? minutes
      : DEFAULT_JOB_TIMEOUT_MINUTES;
  return normalized * 60_000;
};
