'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  MoveDown,
  MoveUp,
  Trash2,
} from 'lucide-react';
import { Badge, Button, cn } from '@/shared';
import { PasteImport } from '@/features/blog-id-import';
import {
  CHECK_KINDS,
  CHECK_KIND_LABELS,
  CHECK_KIND_SHORT_LABELS,
  type BlogGroup,
  type PresetTarget,
} from '@/entities/preset';
import {
  blogIdsToText,
  isCheckKind,
  mergeBlogIds,
  textToBlogIds,
  toggleTargetGroup,
} from '../model';

const FIELD_STYLE = cn(
  'w-full rounded border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2',
  'text-[13px] text-[var(--ink)] outline-none transition-colors',
  'placeholder:text-[var(--ink-faint)]',
  'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
);

interface FieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

const Field = ({ label, children, className }: FieldProps) => (
  <label className={cn('flex flex-col gap-1.5', className)}>
    <span className="stamp">{label}</span>
    {children}
  </label>
);

interface GroupChipProps {
  group: BlogGroup;
  isSelected: boolean;
  onToggle: (groupId: string) => void;
}

const GroupChip = ({ group, isSelected, onToggle }: GroupChipProps) => {
  const handleClick = () => {
    onToggle(group.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[12px]',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--signal)]/40',
        isSelected
          ? 'border-[var(--signal)] bg-[var(--signal)]/10 text-[var(--ink)]'
          : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--line)]/40',
      )}
    >
      {group.label}
      <span className="tabular text-[11px] text-[var(--ink-faint)]">
        {group.blogIds.length}
      </span>
    </button>
  );
};

interface TargetEditorProps {
  target: PresetTarget;
  groups: BlogGroup[];
  index: number;
  isOpen: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChange: (index: number, next: PresetTarget) => void;
  onRemove: (index: number) => void;
  onToggleOpen: (targetId: string) => void;
  onDuplicate: (index: number) => void;
  onMove: (index: number, offset: number) => void;
}

export const TargetEditor = ({
  target,
  groups,
  index,
  isOpen,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onToggleOpen,
  onDuplicate,
  onMove,
}: TargetEditorProps) => {
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...target, label: event.target.value });
  };

  const handleIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...target, id: event.target.value });
  };

  const handleKindChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const kind = event.target.value;
    if (!isCheckKind(kind)) return;
    onChange(index, {
      ...target,
      kind,
      maxPages: kind === 'page' ? (target.maxPages ?? 1) : undefined,
    });
  };

  const handleSourceSheetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      source: { ...target.source, sheetId: event.target.value },
    });
  };

  const handleSourceTabChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      source: { ...target.source, tabTitle: event.target.value },
    });
  };

  const handleResultSheetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      result: {
        sheetId: event.target.value,
        tabTitle: target.result?.tabTitle ?? '',
      },
    });
  };

  const handleResultTabChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      result: {
        sheetId: target.result?.sheetId ?? '',
        tabTitle: event.target.value,
      },
    });
  };

  const handleMaxPagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    onChange(index, {
      ...target,
      maxPages: raw === '' ? undefined : Number(raw),
    });
  };

  const handleBlogIdsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const blogIds = textToBlogIds(event.target.value);
    onChange(index, {
      ...target,
      blogIds: blogIds.length > 0 ? blogIds : undefined,
    });
  };

  const handleBlogIdsPaste = (incoming: string[]) => {
    onChange(index, {
      ...target,
      blogIds: mergeBlogIds(target.blogIds, incoming),
    });
  };

  const handleEnabledToggle = () => {
    onChange(index, { ...target, enabled: !target.enabled });
  };

  const handleRemove = () => {
    onRemove(index);
  };

  const handleToggleOpen = () => {
    onToggleOpen(target.id);
  };

  const handleDuplicate = () => {
    onDuplicate(index);
  };

  const handleMoveUp = () => {
    onMove(index, -1);
  };

  const handleMoveDown = () => {
    onMove(index, 1);
  };

  const handleGroupToggle = (groupId: string) => {
    onChange(index, toggleTargetGroup(target, groupId));
  };

  const writesToSource = !target.result?.sheetId && !target.result?.tabTitle;
  const selectedGroupIds = target.blogGroupIds ?? [];
  const selectedGroups = groups.filter((group) =>
    selectedGroupIds.includes(group.id),
  );
  const groupAccountCount = new Set(
    selectedGroups.flatMap((group) => group.blogIds),
  ).size;
  const directCount = target.blogIds?.length ?? 0;

  return (
    <div
      className={cn(
        'relative rounded-lg border border-[var(--line)] bg-[var(--panel)]',
        'before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full',
        target.enabled
          ? 'before:bg-[var(--signal)]'
          : 'before:bg-[var(--ink-faint)]',
        isOpen && 'border-[var(--signal)]/40',
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 py-2.5 pl-4 pr-3',
          !target.enabled && 'opacity-60',
        )}
      >
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
          <Badge tone={target.enabled ? 'success' : 'neutral'} withDot>
            {CHECK_KIND_SHORT_LABELS[target.kind]}
            {target.kind === 'page' && target.maxPages
              ? ` ${target.maxPages}p`
              : ''}
          </Badge>
          <span className="truncate text-[14px] font-semibold text-[var(--ink)]">
            {target.label || target.id}
          </span>
          <span className="tabular hidden shrink-0 truncate text-[11px] text-[var(--ink-faint)] sm:inline">
            {target.source.tabTitle || '읽기 탭 없음'}
            {writesToSource ? '' : ` → ${target.result?.tabTitle || '쓰기 탭 없음'}`}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <span className="tabular hidden text-[11px] text-[var(--ink-faint)] md:inline">
            계정 {groupAccountCount + directCount || '전체'}
          </span>
          <Button size="sm" variant="ghost" onClick={handleEnabledToggle}>
            {target.enabled ? '켜짐' : '꺼짐'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMoveUp}
            disabled={isFirst}
            aria-label={`${target.label} 위로`}
          >
            <MoveUp className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMoveDown}
            disabled={isLast}
            aria-label={`${target.label} 아래로`}
          >
            <MoveDown className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDuplicate}
            aria-label={`${target.label} 복제`}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            aria-label={`${target.label} 대상 삭제`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {isOpen ? (
        <div className="border-t border-[var(--line)] p-4 pl-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="이름">
              <input
                value={target.label}
                onChange={handleLabelChange}
                placeholder="패키지"
                className={FIELD_STYLE}
              />
            </Field>

            <Field label="대상 id">
              <input
                value={target.id}
                onChange={handleIdChange}
                placeholder="package"
                className={cn(FIELD_STYLE, 'tabular')}
              />
            </Field>

            <Field label="노출체크 종류">
              <select
                value={target.kind}
                onChange={handleKindChange}
                className={FIELD_STYLE}
              >
                {CHECK_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {CHECK_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </Field>

            {target.kind === 'page' ? (
              <Field label="몇 페이지까지">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={target.maxPages ?? ''}
                  onChange={handleMaxPagesChange}
                  placeholder="4"
                  className={cn(FIELD_STYLE, 'tabular')}
                />
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}

            <Field label="읽기 시트 ID">
              <input
                value={target.source.sheetId}
                onChange={handleSourceSheetChange}
                placeholder="1AbC..."
                className={cn(FIELD_STYLE, 'tabular')}
              />
            </Field>

            <Field label="읽기 탭">
              <input
                value={target.source.tabTitle}
                onChange={handleSourceTabChange}
                placeholder="패키지"
                className={FIELD_STYLE}
              />
            </Field>

            <Field label="쓰기 시트 ID">
              <input
                value={target.result?.sheetId ?? ''}
                onChange={handleResultSheetChange}
                placeholder="비우면 읽기 시트에 반영"
                className={cn(FIELD_STYLE, 'tabular')}
              />
            </Field>

            <Field label="쓰기 탭">
              <input
                value={target.result?.tabTitle ?? ''}
                onChange={handleResultTabChange}
                placeholder="비우면 읽기 시트에 반영"
                className={FIELD_STYLE}
              />
            </Field>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="stamp">
                계정 그룹 {groupAccountCount > 0 ? `· 계정 ${groupAccountCount}개` : ''}
              </span>
              {groups.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((group) => (
                    <GroupChip
                      key={group.id}
                      group={group}
                      isSelected={selectedGroupIds.includes(group.id)}
                      onToggle={handleGroupToggle}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[var(--ink-soft)]">
                  위에서 계정 그룹을 먼저 만들면 여기서 골라 쓸 수 있음
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="stamp">
                그룹 밖에서 직접 붙이는 계정 {directCount > 0 ? `· ${directCount}개` : ''}
              </span>
              <textarea
                value={blogIdsToText(target.blogIds)}
                onChange={handleBlogIdsChange}
                rows={2}
                placeholder="비우면 그룹 계정만 봄"
                className={cn(FIELD_STYLE, 'resize-y')}
              />
              <div>
                <PasteImport
                  existing={target.blogIds ?? []}
                  onApply={handleBlogIdsPaste}
                  label="붙여넣기로 추가"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1 text-[12px] text-[var(--ink-soft)]">
            {writesToSource ? <p>결과를 읽기 시트에 그대로 덮어씀</p> : null}
            {selectedGroupIds.length === 0 && directCount === 0 ? (
              <p>고른 그룹이 없어 전체 계정을 봄</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
