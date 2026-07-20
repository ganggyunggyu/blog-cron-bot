import { logger } from './logger';

export const EXPOSURE_PROGRESS_MARKER = '@@EXPOSURE_PROGRESS';

export type ExposureProgressStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed';

export interface ExposureProgressEvent {
  target: string;
  current: number;
  total: number;
  status: ExposureProgressStatus;
}

const normalizeCount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

export const emitExposureProgress = (
  target: string | undefined,
  current: number,
  total: number,
  status: ExposureProgressStatus = 'running'
): void => {
  const normalizedTarget = target?.trim();
  if (!normalizedTarget) return;

  const event: ExposureProgressEvent = {
    target: normalizedTarget,
    current: normalizeCount(current),
    total: normalizeCount(total),
    status,
  };

  logger.info(`${EXPOSURE_PROGRESS_MARKER} ${JSON.stringify(event)}`);
};
