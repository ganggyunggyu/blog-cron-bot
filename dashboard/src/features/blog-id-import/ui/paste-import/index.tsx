'use client';

import React from 'react';
import { ClipboardPaste, Plus, X } from 'lucide-react';
import { Badge, Button, cn, parsePastedBlogIds } from '@/shared';

const HINT: Record<'url' | 'plain', string> = {
  url: '주소가 있어서 링크 칸에서만 아이디를 읽음. 비밀번호나 메모 칸은 안 섞임',
  plain: '주소가 없어서 칸을 그대로 아이디로 읽음. 아닌 게 섞였으면 눌러서 빼면 됨',
};

interface PasteImportProps {
  /** 이미 들어있는 계정. 중복은 미리 걸러서 보여준다. */
  existing: string[];
  onApply: (blogIds: string[]) => void;
  isPending?: boolean;
  label?: string;
  className?: string;
}

export const PasteImport = ({
  existing,
  onApply,
  isPending = false,
  label = '붙여넣기로 추가',
  className,
}: PasteImportProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [excluded, setExcluded] = React.useState<string[]>([]);

  const { blogIds, mode } = React.useMemo(() => parsePastedBlogIds(text), [text]);
  const existingSet = React.useMemo(() => new Set(existing), [existing]);

  const duplicates = blogIds.filter((blogId) => existingSet.has(blogId));
  const fresh = blogIds.filter((blogId) => !existingSet.has(blogId));
  const selected = fresh.filter((blogId) => !excluded.includes(blogId));

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setText('');
    setExcluded([]);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setExcluded([]);
  };

  const handleToggle = (blogId: string) => {
    setExcluded((current) =>
      current.includes(blogId)
        ? current.filter((id) => id !== blogId)
        : [...current, blogId],
    );
  };

  const handleApply = () => {
    if (selected.length === 0) return;
    onApply(selected);
    handleClose();
  };

  if (!isOpen) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={handleOpen}
        className={className}
      >
        <ClipboardPaste className="size-3.5" />
        {label}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--signal)]/40 bg-[var(--paper)] p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="stamp">시트에서 복사한 걸 그대로 붙여넣기</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          aria-label="붙여넣기 닫기"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <textarea
        value={text}
        onChange={handleTextChange}
        rows={4}
        autoFocus
        placeholder={
          '엑셀이나 구글시트에서 행을 통째로 복사해 붙여넣어도 됨\n블로그 주소 칸만 골라서 아이디로 바꿈'
        }
        className={cn(
          'w-full resize-y rounded border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2',
          'text-[13px] text-[var(--ink)] outline-none transition-colors',
          'placeholder:text-[var(--ink-faint)]',
          'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
        )}
      />

      {text.trim().length > 0 ? (
        <React.Fragment>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={selected.length > 0 ? 'success' : 'neutral'}>
              추가 {selected.length}
            </Badge>
            {duplicates.length > 0 ? (
              <Badge tone="neutral">이미 있음 {duplicates.length}</Badge>
            ) : null}
            {blogIds.length === 0 ? (
              <Badge tone="warning">아이디를 못 찾음</Badge>
            ) : null}
            <span className="text-[12px] text-[var(--ink-soft)]">{HINT[mode]}</span>
          </div>

          {fresh.length > 0 ? (
            <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {fresh.map((blogId) => {
                const isExcluded = excluded.includes(blogId);
                return (
                  <button
                    key={blogId}
                    type="button"
                    onClick={() => handleToggle(blogId)}
                    aria-pressed={!isExcluded}
                    className={cn(
                      'tabular rounded border px-1.5 py-0.5 text-[11px] transition-colors',
                      isExcluded
                        ? 'border-[var(--line)] text-[var(--ink-faint)] line-through'
                        : 'border-[var(--signal)]/40 bg-[var(--signal)]/8 text-[var(--ink)]',
                    )}
                  >
                    {blogId}
                  </button>
                );
              })}
            </div>
          ) : null}
        </React.Fragment>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleApply}
          disabled={selected.length === 0 || isPending}
        >
          <Plus className="size-3.5" />
          {isPending ? '추가 중' : `${selected.length}개 추가`}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          취소
        </Button>
      </div>
    </div>
  );
};
