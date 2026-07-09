'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { Square } from 'lucide-react';
import { Badge, Button, Card, selectedRunIdAtom } from '@/shared';
import { useRunLogStream, useStopRun } from '@/entities/run';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  running: 'warning',
  success: 'success',
  failed: 'danger',
  stopped: 'neutral',
};

export const LiveLogViewer = () => {
  const runId = useAtomValue(selectedRunIdAtom);
  const { lines, status } = useRunLogStream(runId);
  const { mutate: stopRun, isPending } = useStopRun();
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    logContainerRef.current?.scrollTo({ top: logContainerRef.current.scrollHeight });
  }, [lines]);

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

  const handleStop = () => {
    stopRun(runId);
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          실시간 로그
        </h2>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[status ?? 'running'] ?? 'neutral'}>{status ?? 'running'}</Badge>
          {isRunning ? (
            <Button variant="danger" disabled={isPending} onClick={handleStop}>
              <Square className="size-4" />
              정지
            </Button>
          ) : null}
        </div>
      </div>
      <div
        ref={logContainerRef}
        className="h-80 overflow-y-auto rounded-md bg-neutral-950 p-3 font-mono text-xs text-neutral-100"
      >
        {lines.length === 0 ? (
          <p className="text-neutral-500">로그 대기 중...</p>
        ) : (
          lines.map((line, index) => <div key={index}>{line}</div>)
        )}
      </div>
    </Card>
  );
};
