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
};

export const JobRunnerPanel = () => {
  const { data: jobs, isLoading, isError } = useJobList();
  const { data: runHistory } = useRunList();
  const { mutate: runJob, isPending, variables } = useRunJob();
  const setSelectedRunId = useSetAtom(selectedRunIdAtom);

  const handleRun = (jobId: string) => {
    runJob({ jobId }, {
      onSuccess: (result) => {
        setSelectedRunId(result.runId);
      },
    });
  };

  return (
    <Card>
      <SectionHeader
        icon={Zap}
        title="한 클릭 노출체크"
        description="원하는 카드의 실행 버튼만 누르면 결과 저장과 알림까지 이어짐"
      />
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">잡 목록을 불러오지 못함</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {jobs?.filter((job) => job.kind === 'standard').map((job) => {
          const isBusy = isPending && variables?.jobId === job.id;
          return (
            <article
              key={job.id}
              className="flex min-h-44 flex-col rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-800"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {job.label}
                  </span>
                  {job.isRunning ? <Badge tone="success">실행 중</Badge> : null}
                  {job.isBlocked ? <Badge tone="warning">다른 노출체크 실행 중</Badge> : null}
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {job.description}
                </span>
                {job.riskNote ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    주의: {job.riskNote}
                  </span>
                ) : null}
              </div>
              <Button
                className="mt-auto w-full"
                variant="secondary"
                disabled={job.isRunning || job.isBlocked || isBusy}
                onClick={() => handleRun(job.id)}
              >
                <PlayCircle className="size-4" />
                한 번에 실행
              </Button>
            </article>
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
