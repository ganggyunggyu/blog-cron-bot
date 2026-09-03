'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { Eye, EyeOff, Square } from 'lucide-react';
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

/** 상태 원문(running, failed)이 화면에 그대로 나오지 않게 붙이는 이름. */
const STATUS_LABELS: Record<string, string> = {
  running: '실행 중',
  success: '성공',
  failed: '실패',
  stopped: '중지',
  unknown: '알 수 없음',
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
        <SectionHeader title="실행 로그" />
        <p className="text-sm text-[var(--ink-soft)]">
          위에서 실행 기록을 하나 고르면 그 로그가 여기 나옵니다.
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
        title="실행 로그"
        description={`성공 ${viewModel.successCount}건${viewModel.failureCount > 0 ? ` · 실패 ${viewModel.failureCount}건` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {connectionLabel ? <Badge tone="warning">{connectionLabel}</Badge> : null}
            <Badge tone={STATUS_TONE[status ?? 'running'] ?? 'neutral'}>
              {STATUS_LABELS[status ?? 'running'] ?? '알 수 없음'}
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
