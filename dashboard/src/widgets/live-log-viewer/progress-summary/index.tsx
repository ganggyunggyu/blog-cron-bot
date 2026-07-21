import type { TargetProgress } from '@/entities/run';
import { EXPOSURE_PROGRESS_LABELS, cn } from '@/shared';

const TARGET_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: '대기',
  running: '진행 중',
  success: '완료',
  failed: '재시도/실패',
};

interface ProgressSummaryProps {
  latestProgress: { current: number; total: number } | null;
  targetProgress: TargetProgress[];
}

const getPercent = (current: number, total: number, isComplete = false) => {
  if (isComplete) return 100;
  return total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
};

export const ProgressSummary = ({ latestProgress, targetProgress }: ProgressSummaryProps) => {
  if (targetProgress.length > 0) {
    return (
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {targetProgress.map((target) => {
          const percent = getPercent(
            target.current,
            target.total,
            target.status === 'success',
          );
          return (
            <div
              key={target.target}
              className="rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {EXPOSURE_PROGRESS_LABELS[target.target] ?? target.target}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {target.total > 0 ? `${target.current}/${target.total} · ` : ''}
                  {TARGET_STATUS_LABELS[target.status] ?? target.status}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                role="progressbar"
                aria-label={`${EXPOSURE_PROGRESS_LABELS[target.target] ?? target.target} 진행률`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    target.status === 'failed'
                      ? 'bg-red-500'
                      : target.status === 'success'
                        ? 'bg-emerald-500'
                        : 'bg-blue-500',
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (!latestProgress) return null;
  const percent = getPercent(latestProgress.current, latestProgress.total);
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>{latestProgress.current}/{latestProgress.total}</span>
        <span>{percent}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label="전체 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
