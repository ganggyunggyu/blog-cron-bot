'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { Eye, EyeOff, Square, Terminal } from 'lucide-react';
import { useRunLogStream, useStopRun } from '@/entities/run';
import { Badge, Button, Card, SectionHeader, selectedRunIdAtom } from '@/shared';
import { buildRunLogViewModel } from './model';
import { ProgressSummary } from './progress-summary';
import { TerminalOutput } from './terminal-output';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  running: 'warning',
  success: 'success',
  failed: 'danger',
  stopped: 'neutral',
  unknown: 'neutral',
};

const CONNECTION_LABELS = {
  connecting: '연결 중',
  reconnecting: '로그 재연결 중',
} as const;

export const LiveLogViewer = () => {
  const runId = useAtomValue(selectedRunIdAtom);
  const { lines, status, connectionState } = useRunLogStream(runId);
  const { mutate: stopRun, isPending } = useStopRun();
  const [showDetail, setShowDetail] = React.useState(false);
  const viewModel = React.useMemo(
    () => buildRunLogViewModel(lines, showDetail),
    [lines, showDetail],
  );

  const handleToggleDetail = () => {
    setShowDetail((current) => !current);
  };

  const handleStop = () => {
    if (runId) stopRun(runId);
  };

  if (!runId) {
    return (
      <Card>
        <SectionHeader icon={Terminal} title="실시간 로그" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          잡을 실행하거나 실행 이력을 선택하면 여기에 로그가 표시됨.
        </p>
      </Card>
    );
  }

  const isRunning = status === null;
  const connectionLabel = connectionState === 'connecting' || connectionState === 'reconnecting'
    ? CONNECTION_LABELS[connectionState]
    : null;

  return (
    <Card>
      <SectionHeader
        icon={Terminal}
        title="실시간 로그"
        description={`성공 ${viewModel.successCount}건${viewModel.failureCount > 0 ? ` · 실패 ${viewModel.failureCount}건` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {connectionLabel ? <Badge tone="warning">{connectionLabel}</Badge> : null}
            <Badge tone={STATUS_TONE[status ?? 'running'] ?? 'neutral'}>
              {status ?? 'running'}
            </Badge>
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
        }
      />
      <ProgressSummary
        latestProgress={viewModel.latestProgress}
        targetProgress={viewModel.targetProgress}
      />
      <TerminalOutput lines={viewModel.visibleLines} />
    </Card>
  );
};
