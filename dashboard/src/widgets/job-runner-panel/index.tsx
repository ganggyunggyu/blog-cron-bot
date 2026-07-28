'use client';

import React from 'react';
import { useSetAtom } from 'jotai';
import { History, Play, Zap } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, cn, formatDateTime, selectedRunIdAtom } from '@/shared';
import { useJobList, useRunJob, type JobCategory, type JobDefinition } from '@/entities/job';
import { useRunList } from '@/entities/run';

const RUN_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  running: 'warning',
  success: 'success',
  failed: 'danger',
  stopped: 'neutral',
  unknown: 'neutral',
};

const RUN_STATUS_LABELS: Record<string, string> = {
  running: '실행 중',
  success: '성공',
  failed: '실패',
  stopped: '중지',
  unknown: '알 수 없음',
};

/** 화면에 보여줄 순서와 이름. 목적이 다른 작업끼리 섞이지 않게 묶는다. */
const CATEGORY_SECTIONS: { id: JobCategory; title: string; hint: string }[] = [
  { id: 'daily', title: '매일 노출체크', hint: '시트별로 하나씩 확인' },
  { id: 'more', title: '더보기 노출체크', hint: '인기글 더보기를 끝까지 펼쳐서 확인' },
  { id: 'pet', title: '애견 · 서리펫', hint: '페이지 범위를 골라서 확인' },
  { id: 'cafe', title: '카페', hint: '카페와 블로그를 함께 확인' },
  { id: 'reexport', title: '다시 내보내기', hint: '재검사 없이 시트에만 반영' },
];

interface JobRowProps {
  job: JobDefinition;
  isBusy: boolean;
  onRun: (jobId: string) => void;
}

const JobRow = ({ job, isBusy, onRun }: JobRowProps) => {
  const handleClick = () => onRun(job.id);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {job.label}
          </span>
          {job.isRunning ? (
            <Badge withDot tone="warning">
              실행 중
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {job.description}
        </p>
        {job.riskNote ? (
          <p className="truncate text-xs text-amber-600 dark:text-amber-400">{job.riskNote}</p>
        ) : null}
      </div>
      <Button
        size="sm"
        variant={job.isRunning ? 'ghost' : 'secondary'}
        className="shrink-0"
        disabled={job.isRunning || job.isBlocked || isBusy}
        onClick={handleClick}
      >
        <Play className="size-3.5" />
        {job.isRunning ? '실행 중' : '실행'}
      </Button>
    </div>
  );
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

  const standardJobs = jobs?.filter((job) => job.kind === 'standard') ?? [];
  const blockedJob = standardJobs.find((job) => job.isBlocked && !job.isRunning);

  return (
    <Card>
      <SectionHeader
        icon={Zap}
        title="개별 노출체크"
        description="필요한 것만 골라서 실행"
        action={
          blockedJob ? (
            <Badge tone="warning">다른 작업 실행 중이라 대기</Badge>
          ) : null
        }
      />

      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">목록을 불러오지 못함</p>
      ) : null}

      <div className="flex flex-col gap-5">
        {CATEGORY_SECTIONS.map((section) => {
          const sectionJobs = standardJobs.filter((job) => job.category === section.id);
          if (sectionJobs.length === 0) return null;

          return (
            <section key={section.id}>
              <div className="mb-1 flex items-baseline gap-2">
                <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {section.title}
                </h3>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {section.hint}
                </span>
              </div>
              <div
                className={cn(
                  'flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-3',
                  'dark:divide-neutral-800 dark:border-neutral-800',
                )}
              >
                {sectionJobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    isBusy={isPending && variables?.jobId === job.id}
                    onRun={handleRun}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {runHistory && runHistory.length > 0 ? (
        <div className="mt-5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            <History className="size-3.5" />
            최근 실행 이력
          </h3>
          <div className="flex flex-col gap-1">
            {runHistory.slice(0, 6).map((run) => (
              <button
                key={run.runId}
                type="button"
                onClick={() => setSelectedRunId(run.runId)}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="truncate text-neutral-700 dark:text-neutral-300">
                  {run.jobLabel}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-neutral-400">
                  {formatDateTime(new Date(run.startedAt).toISOString())}
                  <Badge withDot tone={RUN_STATUS_TONE[run.status] ?? 'neutral'}>
                    {RUN_STATUS_LABELS[run.status] ?? run.status}
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
