import { BLOCKED_INDICATORS } from '../../constants/crawl-config';

export type TransientFailureStage = 'crawl' | 'guest-retry';

interface TransientExposureCheckErrorParams {
  stage: TransientFailureStage;
  searchQuery: string;
  message: string;
  cause?: unknown;
  status?: number;
}

interface TransientFailureContext {
  stage: TransientFailureStage;
  searchQuery: string;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status)
    ? status
    : undefined;
};

export class TransientExposureCheckError extends Error {
  readonly code = 'TRANSIENT_EXPOSURE_CHECK_FAILURE';
  readonly stage: TransientFailureStage;
  readonly searchQuery: string;
  readonly status?: number;

  constructor(params: TransientExposureCheckErrorParams) {
    super(
      `[${params.stage}] "${params.searchQuery}" 노출 판정 보류: ${params.message}`,
      params.cause === undefined ? undefined : { cause: params.cause }
    );
    this.name = 'TransientExposureCheckError';
    this.stage = params.stage;
    this.searchQuery = params.searchQuery;
    this.status = params.status;
  }
}

export const wrapTransientExposureError = (
  error: unknown,
  context: TransientFailureContext
): TransientExposureCheckError => {
  if (error instanceof TransientExposureCheckError) {
    return error;
  }

  return new TransientExposureCheckError({
    ...context,
    message: getErrorMessage(error),
    cause: error,
    status: getErrorStatus(error),
  });
};

export const assertUsableNaverHtml = (
  html: string,
  searchQuery: string,
  stage: TransientFailureStage
): void => {
  if (!html.trim()) {
    throw new TransientExposureCheckError({
      stage,
      searchQuery,
      message: '네이버 응답 본문이 비어 있습니다.',
    });
  }

  const blockedIndicator = BLOCKED_INDICATORS.find((indicator) =>
    html.includes(indicator)
  );
  if (blockedIndicator) {
    throw new TransientExposureCheckError({
      stage,
      searchQuery,
      message: `네이버 차단 페이지 감지 (${blockedIndicator})`,
    });
  }
};

const normalizeConcurrency = (concurrency: number): number =>
  Number.isFinite(concurrency) && concurrency >= 1
    ? Math.floor(concurrency)
    : 1;

export const runTasksWithCancellation = async <T>(
  tasks: readonly T[],
  concurrency: number,
  runTask: (task: T, isCancelled: () => boolean) => Promise<void>
): Promise<void> => {
  let nextTaskIndex = 0;
  let cancelled = false;
  let hasFailure = false;
  let firstError: unknown;
  const workerCount = Math.min(
    normalizeConcurrency(concurrency),
    tasks.length
  );

  const runWorker = async (): Promise<void> => {
    while (!cancelled && nextTaskIndex < tasks.length) {
      const currentTaskIndex = nextTaskIndex;
      nextTaskIndex += 1;

      try {
        await runTask(tasks[currentTaskIndex], () => cancelled);
      } catch (error) {
        if (!hasFailure) {
          hasFailure = true;
          firstError = error;
        }
        cancelled = true;
      }
    }
  };

  await Promise.all(
    Array.from({ length: workerCount }, async () => runWorker())
  );

  if (hasFailure) {
    throw firstError;
  }
};
