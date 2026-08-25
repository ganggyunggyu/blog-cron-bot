'use client';

import React from 'react';
import { Play, Save, X } from 'lucide-react';
import { Button } from '@/shared';

interface SelectionFooterProps {
  count: number;
  maxPages: number | null;
  pageRange: { min: number; max: number };
  isBusy: boolean;
  isSaving: boolean;
  onMaxPagesChange: (value: number) => void;
  onRun: () => void;
  onSaveBundle: (label: string) => void;
  onClear: () => void;
}

/**
 * 체크한 게 있을 때만 뜨는 아래 띠.
 *
 * 고른 조합을 그 자리에서 묶음으로 저장할 수 있어야 한다. 예전에는 여기서 한 번
 * 돌리고 끝이라, 같은 조합을 매일 쓰려면 설정 화면에 가서 처음부터 다시 만들어야 했다.
 */
export const SelectionFooter = ({
  count,
  maxPages,
  pageRange,
  isBusy,
  isSaving,
  onMaxPagesChange,
  onRun,
  onSaveBundle,
  onClear,
}: SelectionFooterProps) => {
  const [isNaming, setIsNaming] = React.useState(false);
  const [label, setLabel] = React.useState('');

  if (count === 0) return null;

  const handlePagesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onMaxPagesChange(Number(event.target.value));
  };

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(event.target.value);
  };

  const handleStartNaming = () => setIsNaming(true);

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onSaveBundle(trimmed);
    setLabel('');
    setIsNaming(false);
  };

  const handleCancelNaming = () => {
    setIsNaming(false);
    setLabel('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--paper)]/50 px-5 py-2.5">
      <span className="tabular text-[13px] text-[var(--ink)]">{count}개 선택</span>

      <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
        애견·서리펫 페이지
        <select
          value={maxPages ?? pageRange.min}
          onChange={handlePagesChange}
          aria-label="애견·서리펫 최대 페이지"
          className="tabular h-7 rounded-md border border-[var(--line)] bg-[var(--panel)] px-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--signal)]"
        >
          {Array.from(
            { length: pageRange.max - pageRange.min + 1 },
            (_, index) => pageRange.min + index,
          ).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      {isNaming ? (
        <React.Fragment>
          <input
            value={label}
            onChange={handleLabelChange}
            autoFocus
            placeholder="묶음 이름"
            aria-label="묶음 이름"
            className="h-7 w-40 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--signal)]"
          />
          <Button size="sm" disabled={!label.trim() || isSaving} onClick={handleSave}>
            <Save className="size-3.5" />
            {isSaving ? '저장 중' : '저장'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelNaming}>
            <X className="size-3.5" />
          </Button>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Button size="sm" disabled={isBusy} onClick={onRun}>
            <Play className="size-3.5" />
            고른 {count}개 실행
          </Button>
          <Button size="sm" variant="secondary" onClick={handleStartNaming}>
            <Save className="size-3.5" />
            묶음으로 저장
          </Button>
        </React.Fragment>
      )}

      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        선택 해제
      </Button>
    </div>
  );
};
