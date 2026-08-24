import React from 'react';
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

interface TerminalOutputProps {
  lines: ParsedLogLine[];
}

export const TerminalOutput = ({ lines }: TerminalOutputProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);

  const handleScroll = () => {
    const element = containerRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
  };

  React.useEffect(() => {
    if (!isNearBottomRef.current) return;
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [lines]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-80 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 font-mono text-xs"
      aria-live="polite"
      aria-label="실시간 실행 로그"
    >
      {lines.length === 0 ? (
        <p className="text-[var(--ink-soft)]">로그 대기 중...</p>
      ) : (
        lines.map((line, index) => (
          <div
            key={`${index}-${line.raw}`}
            className={cn('whitespace-pre-wrap break-all', LINE_TONE[line.kind])}
          >
            {line.raw}
          </div>
        ))
      )}
    </div>
  );
};
