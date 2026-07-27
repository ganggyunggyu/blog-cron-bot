'use client';

import React from 'react';
import { useSetAtom } from 'jotai';
import { History, PlayCircle, Zap } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, formatDateTime, selectedRunIdAtom } from '@/shared';
import { useJobList, useRunJob } from '@/entities/job';
import { useRunList } from '@/entities/run';

const RUN_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  running: 'warning',
  success: 'success',
  failed: 'danger',
  stopped: 'neutral',
  unknown: 'neutral',
};

export const JobRunnerPanel = () => {
  const { data: jobs, isLoading, isError } = useJobList();
  const { data: runHistory } = useRunList();
  const { mutate: runJob, isPending, variables } = useRunJob();
  const setSelectedRunId = useSetAtom(selectedRunIdAtom);

  const handleRun = (jobId: string) => {
    runJob(
      { jobId },
      {
        onSuccess: (result) => {
          setSelectedRunId(result.runId);
        },
      },
    );
  };

  return (
    <Card>
      <SectionHeader
        icon={Zap}
        title="개별 노출체크"
        description="목록에서 하나만 골라 바로 실행"
      />
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">잡 목록을 불러오지 못함</p>
      ) : null}
      <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
        {jobs?.filter((job) => job.kind === 'standard').map((job) => {
          const isBusy = isPending && variables?.jobId === job.id;
          return (
            <div key={job.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {job.label}
                  </span>
                  {job.isRunning ? <Badge tone="success">실행 중</Badge> : null}
                  {job.isBlocked ? <Badge tone="warning">대기</Badge> : null}
                </div>
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {job.description}
                  {job.riskNote ? (
                    <span className="text-amber-600 dark:text-amber-400"> · 주의: {job.riskNote}</span>
                  ) : null}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                disabled={job.isRunning || job.isBlocked || isBusy}
                onClick={() => handleRun(job.id)}
              >
                <PlayCircle className="size-3.5" />
                실행
              </Button>
            </div>
          );
        })}
      </div>

      {runHistory && runHistory.length > 0 ? (
        <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            <History className="size-3.5" />
            최근 실행 이력
          </h3>
          <div className="flex flex-col gap-1">
            {runHistory.slice(0, 8).map((run) => (
              <button
                key={run.runId}
                type="button"
                onClick={() => setSelectedRunId(run.runId)}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="truncate text-neutral-700 dark:text-neutral-300">{run.jobLabel}</span>
                <span className="flex shrink-0 items-center gap-2 text-neutral-400">
                  {formatDateTime(new Date(run.startedAt).toISOString())}
                  <Badge withDot tone={RUN_STATUS_TONE[run.status] ?? 'neutral'}>
                    {run.status}
                  </Badge>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
};
