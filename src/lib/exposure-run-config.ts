export const DEFAULT_EXPOSURE_CONCURRENCY = 8;
export const MAX_EXPOSURE_CONCURRENCY = 8;
export const MAX_EXPOSURE_PAGES = 9;

type ExposureEnvironment = Readonly<Record<string, string | undefined>>;

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const readFirstPositiveInteger = (
  environment: ExposureEnvironment,
  names: readonly string[]
): number | undefined => {
  for (const name of names) {
    const parsed = parsePositiveInteger(environment[name]);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
};

export const getExposureConcurrency = (
  environment: ExposureEnvironment = process.env
): number => {
  const configured = readFirstPositiveInteger(environment, [
    'EXPOSURE_CONCURRENCY',
    'PAGE_CHECK_CONCURRENCY',
  ]);

  return Math.min(
    configured ?? DEFAULT_EXPOSURE_CONCURRENCY,
    MAX_EXPOSURE_CONCURRENCY
  );
};

export const getExposureMaxPages = (
  defaultMaxPages: number,
  environment: ExposureEnvironment = process.env
): number => {
  const configured = readFirstPositiveInteger(environment, [
    'EXPOSURE_MAX_PAGES',
    'PAGE_CHECK_MAX_PAGES',
  ]);

  return Math.min(configured ?? defaultMaxPages, MAX_EXPOSURE_PAGES);
};

export const getGuestRetryAttempts = (
  environment: ExposureEnvironment = process.env
): number => (environment.FAST_EXPOSURE_MODE === 'true' ? 1 : 2);

export interface ConcurrencyBudget {
  taskConcurrency: number;
  perTaskConcurrency: number;
}

export const splitConcurrencyBudget = (
  totalConcurrency: number,
  taskCount: number
): ConcurrencyBudget => {
  const normalizedTotal = Math.min(
    Math.max(1, Math.floor(totalConcurrency)),
    MAX_EXPOSURE_CONCURRENCY
  );
  const normalizedTaskCount = Math.max(0, Math.floor(taskCount));

  if (normalizedTaskCount === 0) {
    return { taskConcurrency: 0, perTaskConcurrency: 1 };
  }

  const taskConcurrency = Math.min(normalizedTotal, normalizedTaskCount);
  return {
    taskConcurrency,
    perTaskConcurrency: Math.max(
      1,
      Math.floor(normalizedTotal / taskConcurrency)
    ),
  };
};
