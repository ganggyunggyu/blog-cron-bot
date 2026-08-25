import React from 'react';
import { Square } from 'lucide-react';
import type { RunSummary } from '@/entities/run';
import { Button, cn, formatDateTime } from '@/shared';
import { formatElapsed } from '../model';

const RUN_STATUS_LABELS: Record<string, string> = {
  running: '실행 중',
  success: '성공',
  failed: '실패',
  stopped: '중지',
  unknown: '알 수 없음',
};

const RUN_STATUS_TONE: Record<string, string> = {
  running: 'text-[var(--signal)]',
  success: 'text-[var(--live)]',
  failed: 'text-[var(--alert)]',
  stopped: 'text-[var(--ink-soft)]',
  unknown: 'text-[var(--ink-faint)]',
};

interface StatusBarProps {
  activeRun: RunSummary | null;
  lastRun: RunSummary | null;
  elapsedMs: number;
  shards: { done: number; total: number; percent: number };
  isStopping: boolean;
  onStop: () => void;
}

/**
 * 카드 맨 위 한 줄.
 *
 * 예전에는 대기/실행 중에 블록을 통째로 갈아치워서, 돌기 시작하면 마지막 실행과
 * 실행 버튼이 사라졌다. 여기서는 줄이 그대로 있고 안의 내용만 바뀐다.
 * 전체 진행률은 위젯이 아니라 카드 위 테두리에 붙는 선으로 그린다.
 */
export const StatusBar = ({
  activeRun,
  lastRun,
  elapsedMs,
  shards,
  isStopping,
  onStop,
}: StatusBarProps) => (
  <div className="relative flex items-center gap-3 border-b border-[var(--line)] px-5 py-3">
    {activeRun && shards.total > 0 ? (
      <span
        className="absolute inset-x-0 top-0 h-0.5 bg-[var(--signal)] transition-[width] duration-500 ease-out"
        style={{ width: `${shards.percent}%` }}
        role="progressbar"
        aria-label="전체 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shards.percent}
      />
    ) : null}

    {activeRun ? (
      <React.Fragment>
        <span className="size-1.5 shrink-0 rounded-full bg-[var(--signal)] animate-pulse-dot" />
        <span className="stamp shrink-0 text-[var(--signal)]">실행 중</span>
        <span className="truncate text-sm font-medium text-[var(--ink)]">
          {activeRun.jobLabel}
        </span>
        <span className="tabular shrink-0 text-xs text-[var(--ink-soft)]">
          {formatElapsed(elapsedMs)}
          {shards.total > 0
            ? ` · ${shards.done}/${shards.total} 조각 · ${shards.percent}%`
            : ''}
        </span>
        <Button
          size="sm"
          variant="danger"
          className="ml-auto shrink-0"
          disabled={isStopping}
          onClick={onStop}
        >
          <Square className="size-3.5" />
          정지
        </Button>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <span className="stamp shrink-0">대기</span>
        {lastRun ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-[var(--ink-faint)]">
            <span>마지막 실행</span>
            <span className="truncate text-[var(--ink-soft)]">{lastRun.jobLabel}</span>
            <span className="tabular">
              {formatDateTime(new Date(lastRun.startedAt).toISOString())}
            </span>
            <span className={cn(RUN_STATUS_TONE[lastRun.status] ?? '')}>
              {RUN_STATUS_LABELS[lastRun.status] ?? lastRun.status}
            </span>
          </span>
        ) : (
          <span className="text-xs text-[var(--ink-faint)]">아직 실행한 적이 없습니다</span>
        )}
      </React.Fragment>
    )}
  </div>
);
