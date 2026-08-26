'use client';

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { CafeCheck } from '@/entities/preset';
import { Button, cn } from '@/shared';

const FIELD_STYLE = cn(
  'w-full rounded border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2',
  'text-[13px] text-[var(--ink)] outline-none transition-colors',
  'placeholder:text-[var(--ink-faint)]',
  'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
);

const linesToText = (values: string[]): string => values.join('\n');
const textToLines = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

interface CafeCheckEditorProps {
  check: CafeCheck;
  onChange: (next: CafeCheck) => void;
  onRemove: () => void;
}

export const CafeCheckEditor = ({
  check,
  onChange,
  onRemove,
}: CafeCheckEditorProps) => {
  const [isEditing, setIsEditing] = React.useState(
    () => !check.sheetUrl || check.targets.length === 0,
  );

  const handleToggleEdit = () => setIsEditing((current) => !current);

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...check, label: event.target.value });
  };

  const handleSheetUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...check, sheetUrl: event.target.value });
  };

  const handleTabChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...check, tabTitle: event.target.value });
  };

  const handleTargetsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...check, targets: textToLines(event.target.value) });
  };

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] px-3.5 py-2.5">
        <span className="text-[13px] font-medium text-[var(--ink)]">
          {check.label || '이름 없음'}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-soft)]">
          {check.tabTitle} 탭 · {check.targets.length}곳 확인
        </span>
        <Button size="sm" variant="ghost" onClick={handleToggleEdit}>
          <Pencil className="size-3.5" />
          편집
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-3.5" />
          삭제
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--signal)]/40 p-3.5">
      <div className="flex items-center gap-2">
        <input
          value={check.label}
          onChange={handleLabelChange}
          placeholder="체크 이름"
          aria-label="체크 이름"
          className={cn(FIELD_STYLE, 'flex-1')}
        />
        <Button size="sm" variant="secondary" onClick={handleToggleEdit}>
          완료
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="stamp">구글시트 주소</span>
        <input
          value={check.sheetUrl}
          onChange={handleSheetUrlChange}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          aria-label="구글시트 주소"
          className={FIELD_STYLE}
        />
        <span className="text-[11px] text-[var(--ink-faint)]">
          이 시트에서 키워드를 읽고 결과도 같은 곳에 씁니다. 서비스 계정에 편집
          권한을 주어야 합니다.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="stamp">탭 이름</span>
        <input
          value={check.tabTitle}
          onChange={handleTabChange}
          placeholder="카페키워드"
          aria-label="탭 이름"
          className={FIELD_STYLE}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="stamp">찾을 카페 · 블로그 주소</span>
        <textarea
          value={linesToText(check.targets)}
          onChange={handleTargetsChange}
          rows={4}
          placeholder={'https://cafe.naver.com/카페이름\nhttps://blog.naver.com/블로그아이디'}
          aria-label="찾을 카페 블로그 주소"
          className={cn(FIELD_STYLE, 'resize-y')}
        />
        <span className="text-[11px] text-[var(--ink-faint)]">
          한 줄에 하나씩 붙여넣습니다. 카페 주소는 카페로, 블로그 주소는 블로그로
          알아서 갈립니다.
        </span>
      </label>
    </div>
  );
};
