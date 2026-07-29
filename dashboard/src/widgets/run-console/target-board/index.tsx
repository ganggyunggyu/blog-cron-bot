import React from 'react';
import { cn } from '@/shared';
import type { TargetRow } from '../model';

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  running: '진행',
  success: '완료',
  failed: '재시도',
};

const RAIL_TONE: Record<string, string> = {
  pending: 'bg-[var(--ink-faint)]',
  running: 'bg-[var(--signal)]',
  success: 'bg-[var(--live)]',
  failed: 'bg-[var(--alert)]',
};

const LABEL_TONE: Record<string, string> = {
  pending: 'text-[var(--ink-faint)]',
  running: 'text-[var(--ink)]',
  success: 'text-[var(--live)]',
  failed: 'text-[var(--alert)]',
};

interface TargetBoardProps {
  rows: TargetRow[];
}

/**
 * 시트별 진행 레일.
 *
 * 레일을 같은 지점에서 시작시키면 어느 시트가 뒤처졌는지 한 줄만 봐도 잡힌다.
 * 이 실행에서 사용자가 알고 싶은 건 "전체 몇 %"가 아니라 "무엇이 남았나"다.
 */
export const TargetBoard = ({ rows }: TargetBoardProps) => {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.target}
          className="grid grid-cols-[68px_1fr_auto] items-center gap-3 border-t border-[var(--line)] py-2.5 first:border-t-0 sm:grid-cols-[84px_1fr_auto]"
        >
          <span
            className={cn(
              'truncate text-[13px] font-medium',
              LABEL_TONE[row.status] ?? 'text-[var(--ink)]',
            )}
          >
            {row.label}
          </span>

          <div
            className="h-[6px] overflow-hidden rounded-full bg-[var(--line)]"
            role="progressbar"
            aria-label={`${row.label} 진행률`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={row.percent}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500 ease-out',
                RAIL_TONE[row.status] ?? 'bg-[var(--signal)]',
              )}
              style={{ width: `${row.percent}%` }}
            />
          </div>

          <span className="tabular flex shrink-0 items-center gap-2 text-xs text-[var(--ink-soft)]">
            {row.total > 0 ? (
              <span>
                {row.status === 'success' ? row.total : row.current}
                <span className="text-[var(--ink-faint)]">/{row.total}</span>
              </span>
            ) : null}
            <span
              className={cn(
                'w-8 text-right',
                LABEL_TONE[row.status] ?? 'text-[var(--ink-soft)]',
              )}
            >
              {STATUS_LABELS[row.status] ?? row.status}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};
