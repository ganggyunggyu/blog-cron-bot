import React from 'react';
import type { LogLineKind, ParsedLogLine } from '@/entities/run';
import { cn } from '@/shared';

const LINE_TONE: Record<LogLineKind, string> = {
  success: 'text-emerald-400',
  failure: 'text-red-400',
  search: 'mt-2 font-semibold text-cyan-300 first:mt-0',
  detail: 'pl-4 text-[11px] text-neutral-500',
  plain: 'text-neutral-200',
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
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-3 py-2">
        <span className="size-2.5 rounded-full bg-neutral-700" />
        <span className="size-2.5 rounded-full bg-neutral-700" />
        <span className="size-2.5 rounded-full bg-neutral-700" />
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-80 overflow-y-auto p-3 font-mono text-xs"
        aria-live="polite"
        aria-label="실시간 실행 로그"
      >
        {lines.length === 0 ? (
          <p className="text-neutral-500">로그 대기 중...</p>
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
    </div>
  );
};
