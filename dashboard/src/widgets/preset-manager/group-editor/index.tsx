'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, cn } from '@/shared';
import { PasteImport } from '@/features/blog-id-import';
import type { BlogGroup } from '@/entities/preset';
import { blogIdsToText, mergeBlogIds, textToBlogIds } from '../model';

const FIELD_STYLE = cn(
  'rounded border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2',
  'text-[13px] text-[var(--ink)] outline-none transition-colors',
  'placeholder:text-[var(--ink-faint)]',
  'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
);

const PREVIEW_LIMIT = 8;

interface GroupRowProps {
  group: BlogGroup;
  index: number;
  usedByCount: number;
  isOpen: boolean;
  onChange: (index: number, next: BlogGroup) => void;
  onRemove: (index: number) => void;
  onToggleOpen: (groupId: string) => void;
}

const GroupRow = ({
  group,
  index,
  usedByCount,
  isOpen,
  onChange,
  onRemove,
  onToggleOpen,
}: GroupRowProps) => {
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...group, label: event.target.value });
  };

  const handleBlogIdsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(index, { ...group, blogIds: textToBlogIds(event.target.value) });
  };

  const handlePaste = (incoming: string[]) => {
    onChange(index, { ...group, blogIds: mergeBlogIds(group.blogIds, incoming) });
  };

  const handleRemove = () => {
    onRemove(index);
  };

  const handleToggleOpen = () => {
    onToggleOpen(group.id);
  };

  const preview = group.blogIds.slice(0, PREVIEW_LIMIT);
  const restCount = group.blogIds.length - preview.length;

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--line)] bg-[var(--paper)]',
        isOpen && 'border-[var(--signal)]/40',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={handleToggleOpen}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-left transition-colors hover:opacity-80"
        >
          {isOpen ? (
            <ChevronUp className="size-4 shrink-0 text-[var(--ink-faint)]" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-[var(--ink-faint)]" />
          )}
          <span className="truncate text-[13px] font-semibold text-[var(--ink)]">
            {group.label || group.id}
          </span>
          <Badge tone={group.blogIds.length > 0 ? 'success' : 'warning'}>
            계정 {group.blogIds.length}
          </Badge>
          {usedByCount > 0 ? (
            <Badge tone="neutral">대상 {usedByCount}곳</Badge>
          ) : (
            <Badge tone="neutral">쓰는 대상 없음</Badge>
          )}
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRemove}
          aria-label={`${group.label} 그룹 삭제`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {!isOpen && preview.length > 0 ? (
        <div className="flex flex-wrap gap-1 px-3 pb-2.5 pl-9">
          {preview.map((blogId) => (
            <span
              key={blogId}
              className="tabular rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-[var(--ink-soft)]"
            >
              {blogId}
            </span>
          ))}
          {restCount > 0 ? (
            <span className="tabular px-1 py-0.5 text-[11px] text-[var(--ink-faint)]">
              외 {restCount}개
            </span>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] p-3">
          <label className="flex flex-col gap-1.5">
            <span className="stamp">그룹 이름</span>
            <input
              value={group.label}
              onChange={handleLabelChange}
              placeholder="준최"
              className={cn(FIELD_STYLE, 'w-full font-medium sm:w-56')}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="stamp">
              계정 목록 · 그룹 id {group.id}
            </span>
            <textarea
              value={blogIdsToText(group.blogIds)}
              onChange={handleBlogIdsChange}
              rows={4}
              placeholder="introsm, airtrd (블로그 주소를 붙여넣어도 됨)"
              className={cn(FIELD_STYLE, 'w-full resize-y')}
            />
          </label>

          <PasteImport existing={group.blogIds} onApply={handlePaste} />
        </div>
      ) : null}
    </div>
  );
};

interface GroupEditorProps {
  groups: BlogGroup[];
  usedCountByGroupId: Record<string, number>;
  openGroupIds: string[];
  onChange: (index: number, next: BlogGroup) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onToggleOpen: (groupId: string) => void;
}

export const GroupEditor = ({
  groups,
  usedCountByGroupId,
  openGroupIds,
  onChange,
  onRemove,
  onAdd,
  onToggleOpen,
}: GroupEditorProps) => {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, index) => (
        <GroupRow
          key={group.id}
          group={group}
          index={index}
          usedByCount={usedCountByGroupId[group.id] ?? 0}
          isOpen={openGroupIds.includes(group.id)}
          onChange={onChange}
          onRemove={onRemove}
          onToggleOpen={onToggleOpen}
        />
      ))}

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--line)] px-4 py-5 text-center text-[13px] text-[var(--ink-soft)]">
          계정 그룹이 없음. 준최, 최블처럼 묶어두면 대상마다 골라 쓸 수 있음
        </p>
      ) : null}

      <div>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" />
          계정 그룹 추가
        </Button>
      </div>
    </div>
  );
};
