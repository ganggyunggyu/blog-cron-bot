'use client';

import React from 'react';
import { Play, Search, X } from 'lucide-react';
import type { JobDefinition } from '@/entities/job';
import { Button, cn } from '@/shared';
import type { CheckRow } from '../model';

const CAFE_HOST_PATTERN = /^https?:\/\/(?:m\.)?cafe\.naver\.com\/.+/i;
const SPA_PATH_PATTERN =
  /^https?:\/\/(?:m\.)?cafe\.naver\.com\/(?:f-e|ca-fe|\d+)(?:\/|$)/i;

/** 서버가 진짜 판정을 한다. 여기서는 붙여넣자마자 알려주는 용도만 한다. */
const describeUrlProblem = (url: string): string | null => {
  if (!CAFE_HOST_PATTERN.test(url)) {
    return '네이버 카페 주소가 아닙니다 (예: https://cafe.naver.com/카페이름/12345)';
  }
  if (SPA_PATH_PATTERN.test(url)) {
    return '카페 이름이 없는 주소입니다. 글을 열고 주소창에 뜨는 주소를 넣어야 합니다';
  }
  return null;
};

interface CheckListRowProps {
  row: CheckRow;
  isSelected: boolean;
  isBusy: boolean;
  error: string | null;
  onToggleSelect?: (targetId: string) => void;
  onRun: (job: JobDefinition, options?: { url: string }) => void;
}

const CheckListRow = ({
  row,
  isSelected,
  isBusy,
  error,
  onToggleSelect,
  onRun,
}: CheckListRowProps) => {
  const [jobIndex, setJobIndex] = React.useState(0);
  const [isUrlOpen, setIsUrlOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');

  const job = row.jobs[jobIndex] ?? row.jobs[0];
  const needsUrl = job.kind === 'root-cafe-url';
  const trimmedUrl = url.trim();
  const urlProblem = trimmedUrl ? describeUrlProblem(trimmedUrl) : null;

  const handleSelect = () => {
    if (row.targetId && onToggleSelect) onToggleSelect(row.targetId);
  };

  const handleJobChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setJobIndex(Number(event.target.value));
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const handleRun = () => {
    if (!needsUrl) {
      onRun(job);
      return;
    }
    // 입력이 필요한 항목은 그 줄 안에서 펼친다. 별도 입력 띠를 두면 어느 버튼과
    // 짝인지 보이지 않는다.
    if (!isUrlOpen) {
      setIsUrlOpen(true);
      return;
    }
    if (!trimmedUrl || urlProblem) return;
    onRun(job, { url: trimmedUrl });
  };

  const handleCancelUrl = () => {
    setIsUrlOpen(false);
    setUrl('');
  };

  const isRowBusy = isBusy || job.isRunning || job.isBlocked;

  return (
    <div className="border-t border-[var(--line)] first:border-t-0">
      <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-3 px-5 py-2.5">
        <span className="flex items-center justify-center">
          {row.targetId && onToggleSelect ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleSelect}
              aria-label={`${row.label} 고르기`}
              className="size-4 shrink-0 accent-[var(--signal)]"
            />
          ) : (
            <span
              className={cn(
                'size-1.5 rounded-full',
                job.isRunning ? 'bg-[var(--signal)]' : 'bg-[var(--line)]',
              )}
            />
          )}
        </span>

        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] text-[var(--ink)]">{row.label}</span>
          {job.isRunning ? (
            <span className="stamp shrink-0 text-[var(--signal)]">실행 중</span>
          ) : null}
          {row.riskNote ? (
            <span className="shrink-0 text-[11px] text-[var(--hold)]">오래 걸림</span>
          ) : null}
        </span>

        <span>
          {row.jobs.length > 1 ? (
            <select
              value={jobIndex}
              onChange={handleJobChange}
              aria-label={`${row.label} 범위`}
              className="h-7 rounded-md border border-[var(--line)] bg-[var(--panel)] px-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--signal)]"
            >
              {row.jobs.map((candidate, index) => (
                <option key={candidate.id} value={index}>
                  {candidate.label.replace(`${row.label} `, '')}
                </option>
              ))}
            </select>
          ) : null}
        </span>

        <Button size="sm" variant="ghost" disabled={isRowBusy} onClick={handleRun}>
          {needsUrl && !isUrlOpen ? (
            <Search className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {needsUrl && !isUrlOpen ? '주소 넣기' : '실행'}
        </Button>
      </div>

      {needsUrl && isUrlOpen ? (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-2.5 pl-[52px]">
          <input
            type="url"
            value={url}
            onChange={handleUrlChange}
            autoFocus
            placeholder="https://cafe.naver.com/카페이름/글번호"
            aria-label="확인할 카페 글 주소"
            className="h-8 min-w-48 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={isRowBusy || !trimmedUrl || urlProblem !== null}
            onClick={handleRun}
          >
            확인
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelUrl}>
            <X className="size-3.5" />
          </Button>
          {urlProblem ? (
            <p className="w-full text-[11px] text-[var(--ink-faint)]">{urlProblem}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="px-5 pb-2.5 pl-[52px] text-[11px] text-[var(--alert)]">{error}</p>
      ) : null}
    </div>
  );
};

interface CheckListProps {
  title: string;
  rows: CheckRow[];
  selectedTargets: string[];
  isBusy: boolean;
  errorByJobId: Record<string, string>;
  onToggleSelect?: (targetId: string) => void;
  onRun: (job: JobDefinition, options?: { url: string }) => void;
}

export const CheckList = ({
  title,
  rows,
  selectedTargets,
  isBusy,
  errorByJobId,
  onToggleSelect,
  onRun,
}: CheckListProps) => {
  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className="px-5 pt-4 pb-1.5 text-xs font-medium text-[var(--ink-faint)]">
        {title}
      </h3>
      {rows.map((row) => (
        <CheckListRow
          key={row.targetId ?? row.jobs[0].id}
          row={row}
          isSelected={row.targetId ? selectedTargets.includes(row.targetId) : false}
          isBusy={isBusy}
          error={row.jobs.map(({ id }) => errorByJobId[id]).find(Boolean) ?? null}
          onToggleSelect={onToggleSelect}
          onRun={onRun}
        />
      ))}
    </div>
  );
};
