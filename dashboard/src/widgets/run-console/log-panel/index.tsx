'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { LogLineKind, ParsedLogLine } from '@/entities/run';
import { cn } from '@/shared';

const LINE_TONE: Record<LogLineKind, string> = {
  success: 'text-[var(--live)]',
  failure: 'text-[var(--alert)]',
  search: 'mt-2 font-semibold text-[var(--ink)] first:mt-0',
  detail: 'pl-4 text-[11px] text-[var(--ink-faint)]',
  plain: 'text-[var(--ink-soft)]',
};

const NEAR_BOTTOM_THRESHOLD_PX = 80;

interface LogPanelProps {
  lines: ParsedLogLine[];
  successCount: number;
  failureCount: number;
}

/** 로그는 평소엔 접어둔다. 문제가 생겼을 때만 펼쳐 보는 자료다. */
export const LogPanel = ({ lines, successCount, failureCount }: LogPanelProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);

  const handleToggle = () => setIsOpen((current) => !current);

  const handleScroll = () => {
    const element = containerRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
  };

  React.useEffect(() => {
    if (!isOpen || !isNearBottomRef.current) return;
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [lines, isOpen]);

  return (
    <div className="border-t border-[var(--line)]">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
      >
        <span className="flex items-center gap-2">
          로그
          <span className="tabular text-xs text-[var(--ink-faint)]">
            성공 {successCount}
            {failureCount > 0 ? ` · 실패 ${failureCount}` : ''}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen ? (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-72 overflow-y-auto border-t border-[var(--line)] px-5 py-3 font-mono text-[11px] leading-5"
          aria-live="polite"
          aria-label="실행 로그"
        >
          {lines.length === 0 ? (
            <p className="text-[var(--ink-faint)]">로그 대기 중</p>
          ) : (
            lines.map((line, index) => (
              <div
                key={`${index}-${line.raw}`}
                className={cn('break-all whitespace-pre-wrap', LINE_TONE[line.kind])}
              >
                {line.raw}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};
