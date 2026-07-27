import type { ExposureTargetId } from '../exposure-suite/options';

const DEFAULT_JOB_TIMEOUT_MINUTES = 10;
const DEFAULT_PAGE_JOB_TIMEOUT_MINUTES = 2;

export const getDistributedJobTimeoutMs = (
  value = process.env.DISTRIBUTED_EXPOSURE_JOB_TIMEOUT_MINUTES,
  target?: ExposureTargetId
): number => {
  const minutes = Number(value);
  const defaultMinutes =
    target === 'root' || target === 'pet' || target === 'suripet'
      ? DEFAULT_PAGE_JOB_TIMEOUT_MINUTES
      : DEFAULT_JOB_TIMEOUT_MINUTES;
  const normalized =
    Number.isFinite(minutes) && minutes >= 1
      ? minutes
      : defaultMinutes;
  return normalized * 60_000;
};
