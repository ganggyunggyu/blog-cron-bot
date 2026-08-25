'use client';

import React from 'react';
import { Button, cn } from '@/shared';
import { PasteImport } from '@/features/blog-id-import';
import type { BlogGroup, PresetTarget } from '@/entities/preset';
import { blogIdsToText, mergeBlogIds, textToBlogIds, toggleTargetGroup } from '../model';

/**
 * 계정 목록을 프리셋에서 읽어가는 대상.
 *
 * 봇의 applyPresetBlogIds가 이 여섯 개만 해석한다. 나머지 대상은 계정을 붙여둬도
 * 크롤에 넘어가지 않아서, 붙일 수 있는 것처럼 보이면 안 된다.
 */
const TARGETS_USING_PRESET_ACCOUNTS = new Set([
  'package',
  'general',
  'dogmaru',
  'root',
  'pet',
  'suripet',
]);

/**
 * 계정을 스스로 정하지 못하고 package를 따라가는 대상.
 *
 * blog-id-overrides가 base를 package ?? general ?? root 순서로 고르기 때문에,
 * package에 그룹이 붙어 있으면 이 둘에 뭘 붙이든 쓰이지 않는다.
 */
const TARGETS_FOLLOWING_PACKAGE = new Set(['general', 'root']);

interface GroupChipProps {
  group: BlogGroup;
  isSelected: boolean;
  onToggle: (groupId: string) => void;
}

const GroupChip = ({ group, isSelected, onToggle }: GroupChipProps) => {
  const handleClick = () => onToggle(group.id);

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
  packageHasGroups: boolean;
  onChange: (index: number, next: PresetTarget) => void;
  onToggleOpen: (targetId: string) => void;
}

export const TargetEditor = ({
  target,
  groups,
  index,
  isOpen,
  packageHasGroups,
  onChange,
  onToggleOpen,
}: TargetEditorProps) => {
  const usesPresetAccounts = TARGETS_USING_PRESET_ACCOUNTS.has(target.id);
  const followsPackage =
    packageHasGroups && TARGETS_FOLLOWING_PACKAGE.has(target.id);

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...target, label: event.target.value });
  };

  const handleEnabledToggle = () => {
    onChange(index, { ...target, enabled: !target.enabled });
  };

  const handleToggleOpen = () => onToggleOpen(target.id);

  const handleGroupToggle = (groupId: string) => {
    onChange(index, toggleTargetGroup(target, groupId));
  };

  const handleBlogIdsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const blogIds = textToBlogIds(event.target.value);
    onChange(index, { ...target, blogIds: blogIds.length > 0 ? blogIds : undefined });
  };

  const handleBlogIdsPaste = (incoming: string[]) => {
    onChange(index, { ...target, blogIds: mergeBlogIds(target.blogIds, incoming) });
  };

  const selectedGroupIds = target.blogGroupIds ?? [];
  const groupAccountCount = new Set(
    groups
      .filter((group) => selectedGroupIds.includes(group.id))
      .flatMap((group) => group.blogIds),
  ).size;
  const directCount = target.blogIds?.length ?? 0;

  const describeAccounts = (): string => {
    if (!usesPresetAccounts) return '계정은 봇 설정을 따릅니다';
    if (followsPackage) return '패키지와 같은 계정 목록을 씁니다';
    const total = groupAccountCount + directCount;
    return total > 0 ? `계정 ${total}개` : '계정 전체';
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--line)] bg-[var(--panel)]',
        !target.enabled && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <Button
          size="sm"
          variant={target.enabled ? 'secondary' : 'ghost'}
          onClick={handleEnabledToggle}
        >
          {target.enabled ? '켜짐' : '꺼짐'}
        </Button>

        <input
          value={target.label}
          onChange={handleLabelChange}
          aria-label="체크 이름"
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-[var(--ink)] outline-none transition-colors hover:border-[var(--line)] focus:border-[var(--signal)]"
        />

        <span className="shrink-0 text-[11px] text-[var(--ink-faint)]">
          {describeAccounts()}
        </span>

        {usesPresetAccounts && !followsPackage ? (
          <Button size="sm" variant="ghost" onClick={handleToggleOpen}>
            {isOpen ? '계정 닫기' : '계정 고르기'}
          </Button>
        ) : null}
      </div>

      {isOpen && usesPresetAccounts && !followsPackage ? (
        <div className="flex flex-col gap-2.5 border-t border-[var(--line)] px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {groups.map((group) => (
              <GroupChip
                key={group.id}
                group={group}
                isSelected={selectedGroupIds.includes(group.id)}
                onToggle={handleGroupToggle}
              />
            ))}
            {groups.length === 0 ? (
              <span className="text-[12px] text-[var(--ink-faint)]">
                먼저 계정 그룹을 만들어야 고를 수 있습니다
              </span>
            ) : null}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="stamp">이 체크에만 더할 계정</span>
            <textarea
              value={blogIdsToText(target.blogIds)}
              onChange={handleBlogIdsChange}
              rows={2}
              placeholder="비우면 그룹 계정만 사용합니다"
              className="w-full rounded border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20"
            />
          </label>
          <PasteImport
            existing={target.blogIds ?? []}
            onApply={handleBlogIdsPaste}
          />
        </div>
      ) : null}

      {followsPackage ? (
        <p className="border-t border-[var(--line)] px-3.5 py-2 text-[11px] text-[var(--ink-faint)]">
          이 체크는 패키지에 붙인 계정 목록을 그대로 씁니다.
        </p>
      ) : null}

      {!usesPresetAccounts ? (
        <p className="border-t border-[var(--line)] px-3.5 py-2 text-[11px] text-[var(--ink-faint)]">
          이 체크가 볼 계정은 봇 설정에 정해져 있어 여기서 바꿀 수 없습니다.
        </p>
      ) : null}
    </div>
  );
};
