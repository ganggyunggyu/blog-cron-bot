'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, cn } from '@/shared';
import type { BlogGroup } from '@/entities/preset';
import { blogIdsToText, textToBlogIds } from '../model';

const FIELD_STYLE = cn(
  'rounded border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2',
  'text-[13px] text-[var(--ink)] outline-none transition-colors',
  'placeholder:text-[var(--ink-faint)]',
  'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
);

interface GroupRowProps {
  group: BlogGroup;
  index: number;
  usedByCount: number;
  onChange: (index: number, next: BlogGroup) => void;
  onRemove: (index: number) => void;
}

const GroupRow = ({
  group,
  index,
  usedByCount,
  onChange,
  onRemove,
}: GroupRowProps) => {
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...group, label: event.target.value });
  };

  const handleBlogIdsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(index, { ...group, blogIds: textToBlogIds(event.target.value) });
  };

  const handleRemove = () => {
    onRemove(index);
  };

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={group.label}
          onChange={handleLabelChange}
          placeholder="준최"
          className={cn(FIELD_STYLE, 'w-32 font-medium')}
        />
        <span className="tabular text-[11px] text-[var(--ink-faint)]">
          {group.id}
        </span>
        <Badge tone={group.blogIds.length > 0 ? 'success' : 'warning'}>
          계정 {group.blogIds.length}
        </Badge>
        {usedByCount > 0 ? (
          <Badge tone="neutral">대상 {usedByCount}곳에서 씀</Badge>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRemove}
          className="ml-auto"
          aria-label={`${group.label} 그룹 삭제`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <textarea
        value={blogIdsToText(group.blogIds)}
        onChange={handleBlogIdsChange}
        rows={2}
        placeholder="introsm, airtrd (블로그 주소를 붙여넣어도 됨)"
        className={cn(FIELD_STYLE, 'w-full resize-y')}
      />
    </div>
  );
};

interface GroupEditorProps {
  groups: BlogGroup[];
  usedCountByGroupId: Record<string, number>;
  onChange: (index: number, next: BlogGroup) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

export const GroupEditor = ({
  groups,
  usedCountByGroupId,
  onChange,
  onRemove,
  onAdd,
}: GroupEditorProps) => {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, index) => (
        <GroupRow
          key={group.id}
          group={group}
          index={index}
          usedByCount={usedCountByGroupId[group.id] ?? 0}
          onChange={onChange}
          onRemove={onRemove}
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
