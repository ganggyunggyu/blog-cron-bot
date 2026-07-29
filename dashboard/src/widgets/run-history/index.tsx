'use client';

import React from 'react';
import { useAtom } from 'jotai';
import { Card, SectionHeader, cn, formatDateTime, selectedRunIdAtom } from '@/shared';
import { useRunList } from '@/entities/run';

const STATUS_LABELS: Record<string, string> = {
  running: '실행 중',
  success: '성공',
  failed: '실패',
  stopped: '중지',
  unknown: '알 수 없음',
};

const STATUS_TONE: Record<string, string> = {
  running: 'text-[var(--signal)]',
  success: 'text-[var(--live)]',
  failed: 'text-[var(--alert)]',
  stopped: 'text-[var(--ink-soft)]',
  unknown: 'text-[var(--ink-faint)]',
};

export const RunHistory = () => {
  const { data: runs, isLoading } = useRunList();
  const [selectedRunId, setSelectedRunId] = useAtom(selectedRunIdAtom);

  return (
    <Card>
      <SectionHeader title="실행 기록" description="고르면 아래에 로그가 뜸" />

      {isLoading ? (
        <p className="text-sm text-[var(--ink-soft)]">불러오는 중</p>
      ) : null}

      <div className="flex flex-col">
        {runs?.map((run) => {
          const handleClick = () => setSelectedRunId(run.runId);
          return (
            <button
              key={run.runId}
              type="button"
              onClick={handleClick}
              className={cn(
                'flex items-center justify-between gap-3 border-t border-[var(--line)] px-2 py-2.5 text-left transition-colors first:border-t-0',
                'hover:bg-[var(--line)]/40',
                selectedRunId === run.runId && 'bg-[var(--signal)]/10',
              )}
            >
              <span className="truncate text-[13px] text-[var(--ink)]">
                {run.jobLabel}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                <span className="tabular text-[var(--ink-faint)]">
                  {formatDateTime(new Date(run.startedAt).toISOString())}
                </span>
                <span className={cn('w-12 text-right', STATUS_TONE[run.status] ?? '')}>
                  {STATUS_LABELS[run.status] ?? run.status}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};
