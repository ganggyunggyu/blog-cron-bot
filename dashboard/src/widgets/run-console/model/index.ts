import { EXPOSURE_PROGRESS_LABELS } from '@/shared';
import type { TargetProgress, TargetProgressStatus } from '@/entities/run';

export interface TargetRow {
  target: string;
  label: string;
  current: number;
  total: number;
  percent: number;
  status: TargetProgressStatus;
}

export interface ShardTotal {
  done: number;
  total: number;
  percent: number;
}

const toPercent = (current: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
};

/**
 * 대상 한 줄을 만든다.
 *
 * 완료 신호는 total 없이 오기도 해서, 완료면 진행률을 100으로 고정한다.
 * 그러지 않으면 끝난 시트가 절반쯤에서 멈춘 것처럼 보인다.
 */
export const buildTargetRows = (
  targetProgress: readonly TargetProgress[],
): TargetRow[] =>
  targetProgress.map(({ target, current, total, status }) => ({
    target,
    label: EXPOSURE_PROGRESS_LABELS[target] ?? target,
    current,
    total,
    percent: status === 'success' ? 100 : toPercent(current, total),
    status,
  }));

/** 모든 시트의 조각을 합쳐 실행 하나의 전체 진행률로 만든다. */
export const summarizeShards = (rows: readonly TargetRow[]): ShardTotal => {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const done = rows.reduce(
    (sum, row) => sum + (row.status === 'success' ? row.total : row.current),
    0,
  );
  return { done, total, percent: toPercent(done, total) };
};

/** 경과 시간. 초 단위까지 보여야 "지금 살아있다"는 게 전달된다. */
export const formatElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
};

export * from './rows';
