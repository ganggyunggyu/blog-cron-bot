'use client';

import React from 'react';
import { ChevronDown, Play } from 'lucide-react';
import { Button, Card, cn } from '@/shared';
import { useJobList, useRunJob, type JobCategory, type JobDefinition } from '@/entities/job';

/** 화면에 보여줄 순서와 이름. 목적이 다른 작업끼리 섞이지 않게 묶는다. */
const CATEGORY_SECTIONS: { id: JobCategory; title: string }[] = [
  { id: 'daily', title: '매일 노출체크' },
  { id: 'more', title: '더보기' },
  { id: 'pet', title: '애견 · 서리펫' },
  { id: 'cafe', title: '카페' },
  { id: 'reexport', title: '다시 내보내기' },
];

interface JobRowProps {
  job: JobDefinition;
  isBusy: boolean;
  onRun: (jobId: string) => void;
}

const JobRow = ({ job, isBusy, onRun }: JobRowProps) => {
  const handleClick = () => onRun(job.id);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] py-2 first:border-t-0">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[13px] text-[var(--ink)]">{job.label}</span>
        {job.isRunning ? (
          <span className="stamp shrink-0 text-[var(--signal)]">Running</span>
        ) : null}
        {job.riskNote ? (
          <span className="shrink-0 text-[11px] text-[var(--hold)]">오래 걸림</span>
        ) : null}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0"
        disabled={job.isRunning || job.isBlocked || isBusy}
        onClick={handleClick}
      >
        <Play className="size-3.5" />
        실행
      </Button>
    </div>
  );
};

export const JobRunnerPanel = () => {
  const { data: jobs, isError } = useJobList();
  const { mutate: runJob, isPending, variables } = useRunJob();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleToggle = () => setIsOpen((current) => !current);
  const handleRun = (jobId: string) => runJob({ jobId });

  const standardJobs = jobs?.filter((job) => job.kind === 'standard') ?? [];

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left transition-colors hover:text-[var(--ink)]"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-[15px] font-medium text-[var(--ink)]">개별 실행</span>
          <span className="text-xs text-[var(--ink-faint)]">
            시트 하나만 따로 돌릴 때
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-[var(--ink-soft)] transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen ? (
        <div className="border-t border-[var(--line)] px-5 py-4">
          {isError ? (
            <p className="text-sm text-[var(--alert)]">목록을 불러오지 못함</p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            {CATEGORY_SECTIONS.map((section) => {
              const sectionJobs = standardJobs.filter(
                (job) => job.category === section.id,
              );
              if (sectionJobs.length === 0) return null;

              return (
                <section key={section.id}>
                  <h3 className="mb-1 text-xs font-medium text-[var(--ink-faint)]">
                    {section.title}
                  </h3>
                  <div className="flex flex-col">
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
        </div>
      ) : null}
    </Card>
  );
};
