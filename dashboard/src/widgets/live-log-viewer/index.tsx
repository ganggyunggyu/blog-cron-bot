'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { Eye, EyeOff, Square } from 'lucide-react';
import { Badge, Button, Card, cn, selectedRunIdAtom } from '@/shared';
import {
  findLatestProgress,
  parseLogLine,
  useRunLogStream,
  useStopRun,
  type LogLineKind,
} from '@/entities/run';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  running: 'warning',
  success: 'success',
  failed: 'danger',
  stopped: 'neutral',
};

const LINE_TONE: Record<LogLineKind, string> = {
  success: 'text-emerald-400',
  failure: 'text-red-400',
  search: 'mt-2 font-semibold text-cyan-300 first:mt-0',
  detail: 'pl-4 text-[11px] text-neutral-500',
  plain: 'text-neutral-200',
};

const NEAR_BOTTOM_THRESHOLD_PX = 80;

export const LiveLogViewer = () => {
  const runId = useAtomValue(selectedRunIdAtom);
  const { lines, status } = useRunLogStream(runId);
  const { mutate: stopRun, isPending } = useStopRun();
  const logContainerRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);
  const [showDetail, setShowDetail] = React.useState(false);

  const parsedLines = React.useMemo(() => lines.map(parseLogLine), [lines]);
  const visibleLines = React.useMemo(
    () => (showDetail ? parsedLines : parsedLines.filter((line) => line.kind !== 'detail')),
    [parsedLines, showDetail],
  );
  const latestProgress = React.useMemo(() => findLatestProgress(parsedLines), [parsedLines]);
  const successCount = React.useMemo(
    () => parsedLines.filter((line) => line.kind === 'success').length,
    [parsedLines],
  );
  const failureCount = React.useMemo(
    () => parsedLines.filter((line) => line.kind === 'failure').length,
    [parsedLines],
  );

  const handleScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
  };

  const handleToggleDetail = () => {
    setShowDetail((prev) => !prev);
  };

  const handleStop = () => {
    if (!runId) return;
    stopRun(runId);
  };

  React.useEffect(() => {
    if (!isNearBottomRef.current) return;
    logContainerRef.current?.scrollTo({ top: logContainerRef.current.scrollHeight });
  }, [visibleLines]);

  if (!runId) {
    return (
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          실시간 로그
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          잡을 실행하거나 실행 이력을 선택하면 여기에 로그가 표시됨.
        </p>
      </Card>
    );
  }

  const isRunning = status === null;
  const progressPercent = latestProgress
    ? Math.min(100, Math.round((latestProgress.current / latestProgress.total) * 100))
    : null;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            실시간 로그
          </h2>
          <span className="text-xs text-emerald-500">✓ {successCount}</span>
          {failureCount > 0 ? <span className="text-xs text-red-500">✖ {failureCount}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[status ?? 'running'] ?? 'neutral'}>{status ?? 'running'}</Badge>
          <Button variant="ghost" onClick={handleToggleDetail}>
            {showDetail ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showDetail ? '간결히 보기' : '상세 보기'}
          </Button>
          {isRunning ? (
            <Button variant="danger" disabled={isPending} onClick={handleStop}>
              <Square className="size-4" />
              정지
            </Button>
          ) : null}
        </div>
      </div>

      {latestProgress ? (
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {latestProgress.current}/{latestProgress.total}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="h-80 overflow-y-auto rounded-md bg-neutral-950 p-3 font-mono text-xs"
      >
        {visibleLines.length === 0 ? (
          <p className="text-neutral-500">로그 대기 중...</p>
        ) : (
          visibleLines.map((line, index) => (
            <div key={index} className={cn('whitespace-pre-wrap break-all', LINE_TONE[line.kind])}>
              {line.raw}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
