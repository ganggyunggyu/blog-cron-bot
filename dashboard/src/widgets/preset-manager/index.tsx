'use client';

import React from 'react';
import { Plus, RotateCcw, Save, Search } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, cn } from '@/shared';
import {
  usePreset,
  useSavePreset,
  type BlogGroup,
  type PresetTarget,
  type TenantPreset,
} from '@/entities/preset';
import { GroupEditor } from './group-editor';
import { TargetEditor } from './target-editor';
import {
  countGroupUsage,
  createEmptyGroup,
  createEmptyTarget,
  duplicateTargetAt,
  matchesTargetQuery,
  moveTarget,
  removeGroupAt,
  replaceGroup,
  replaceTarget,
  toSavablePreset,
} from './model';

const toErrorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? fallback;
};

const toggleId = (current: string[], id: string) =>
  current.includes(id) ? current.filter((value) => value !== id) : [...current, id];

export const PresetManager = () => {
  const { data, isLoading, error } = usePreset();
  const { mutate, isPending, error: saveError, isSuccess } = useSavePreset();
  const [draft, setDraft] = React.useState<TenantPreset | null>(null);
  const [openTargetIds, setOpenTargetIds] = React.useState<string[]>([]);
  const [openGroupIds, setOpenGroupIds] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState('');

  const serverPreset = data?.preset ?? null;
  const preset = draft ?? serverPreset;
  const isDirty =
    draft !== null &&
    serverPreset !== null &&
    JSON.stringify(toSavablePreset(draft)) !==
      JSON.stringify(toSavablePreset(serverPreset));

  const handleTargetChange = (index: number, next: PresetTarget) => {
    if (!preset) return;
    // 대상 id를 고치면 펼침 상태가 따라가야 카드가 갑자기 접히지 않는다.
    const previousId = preset.targets[index]?.id;
    if (previousId && previousId !== next.id) {
      setOpenTargetIds((current) =>
        current.map((id) => (id === previousId ? next.id : id)),
      );
    }
    setDraft({ ...preset, targets: replaceTarget(preset.targets, index, next) });
  };

  const handleTargetRemove = (index: number) => {
    if (!preset) return;
    setDraft({
      ...preset,
      targets: preset.targets.filter((_, at) => at !== index),
    });
  };

  const handleTargetAdd = () => {
    if (!preset) return;
    const target = createEmptyTarget(preset.targets);
    setDraft({ ...preset, targets: [...preset.targets, target] });
    setOpenTargetIds((current) => [...current, target.id]);
  };

  const handleTargetDuplicate = (index: number) => {
    if (!preset) return;
    const targets = duplicateTargetAt(preset.targets, index);
    setDraft({ ...preset, targets });
    const copyId = targets[index + 1]?.id;
    if (copyId) setOpenTargetIds((current) => [...current, copyId]);
  };

  const handleTargetMove = (index: number, offset: number) => {
    if (!preset) return;
    setDraft({ ...preset, targets: moveTarget(preset.targets, index, offset) });
  };

  const handleTargetToggleOpen = (targetId: string) => {
    setOpenTargetIds((current) => toggleId(current, targetId));
  };

  const handleGroupChange = (index: number, next: BlogGroup) => {
    if (!preset) return;
    setDraft({ ...preset, blogGroups: replaceGroup(preset.blogGroups, index, next) });
  };

  const handleGroupRemove = (index: number) => {
    if (!preset) return;
    setDraft(removeGroupAt(preset, index));
  };

  const handleGroupAdd = () => {
    if (!preset) return;
    const group = createEmptyGroup(preset.blogGroups);
    setDraft({ ...preset, blogGroups: [...preset.blogGroups, group] });
    setOpenGroupIds((current) => [...current, group.id]);
  };

  const handleGroupToggleOpen = (groupId: string) => {
    setOpenGroupIds((current) => toggleId(current, groupId));
  };

  const handleWebhookChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!preset) return;
    setDraft({ ...preset, doorayWebhookUrl: event.target.value });
  };

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleExpandAll = () => {
    if (!preset) return;
    setOpenTargetIds(preset.targets.map(({ id }) => id));
  };

  const handleCollapseAll = () => {
    setOpenTargetIds([]);
  };

  const handleReset = () => {
    setDraft(null);
  };

  const handleSave = () => {
    if (!preset) return;
    mutate(toSavablePreset(preset), { onSuccess: () => setDraft(null) });
  };

  if (isLoading) {
    return (
      <Card>
        <p className="text-[13px] text-[var(--ink-soft)]">프리셋 불러오는 중</p>
      </Card>
    );
  }

  if (error || !preset) {
    return (
      <Card>
        <p className="text-[13px] text-[var(--alert)]">
          {toErrorMessage(error, '프리셋을 불러오지 못함')}
        </p>
      </Card>
    );
  }

  const enabledCount = preset.targets.filter(({ enabled }) => enabled).length;
  const visibleTargets = preset.targets
    .map((target, index) => ({ target, index }))
    .filter(({ target }) => matchesTargetQuery(target, query));
  const hiddenCount = preset.targets.length - visibleTargets.length;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'sticky top-[73px] z-10 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3',
          'bg-[var(--panel)]/95 backdrop-blur-sm',
          isDirty ? 'border-[var(--hold)]/50' : 'border-[var(--line)]',
        )}
      >
        <Badge tone={isDirty ? 'warning' : 'success'} withDot>
          {isDirty ? '저장 안 됨' : '저장됨'}
        </Badge>
        <span className="tabular text-[12px] text-[var(--ink-soft)]">
          대상 {enabledCount}/{preset.targets.length} · 그룹 {preset.blogGroups.length}
        </span>
        {data?.member ? (
          <span className="text-[12px] text-[var(--ink-faint)]">
            {data.member.displayName}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {saveError ? (
            <span className="text-[12px] text-[var(--alert)]">
              {toErrorMessage(saveError, '프리셋을 저장하지 못함')}
            </span>
          ) : null}
          {isSuccess && !isDirty ? (
            <span className="text-[12px] text-[var(--live)]">방금 저장함</span>
          ) : null}
          {isDirty ? (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="size-3.5" />
              되돌리기
            </Button>
          ) : null}
          <Button size="sm" onClick={handleSave} disabled={!isDirty || isPending}>
            <Save className="size-3.5" />
            {isPending ? '저장 중' : '저장'}
          </Button>
        </div>
      </div>

      <Card>
        <SectionHeader
          title="계정 그룹"
          description="준최, 최블처럼 묶어두고 대상마다 골라 씀. 시트에서 복사한 행을 그대로 붙여넣어도 됨"
          action={<Badge tone="neutral">실행 미반영</Badge>}
        />
        <GroupEditor
          groups={preset.blogGroups}
          usedCountByGroupId={countGroupUsage(preset.targets)}
          openGroupIds={openGroupIds}
          onChange={handleGroupChange}
          onRemove={handleGroupRemove}
          onAdd={handleGroupAdd}
          onToggleOpen={handleGroupToggleOpen}
        />
      </Card>

      <Card>
        <SectionHeader
          title="노출체크 대상"
          description="대상마다 읽는 시트와 쓰는 시트를 따로 잡음. 아직 저장까지만 되고, 실행은 코드 기본값을 봄"
          action={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleExpandAll}>
                모두 펼치기
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCollapseAll}>
                모두 접기
              </Button>
            </div>
          }
        />

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="이름, 대상 id, 시트 탭으로 찾기"
            className={cn(
              'w-full rounded border border-[var(--line)] bg-[var(--paper)] py-2 pl-8 pr-2.5',
              'text-[13px] text-[var(--ink)] outline-none transition-colors',
              'placeholder:text-[var(--ink-faint)]',
              'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          {visibleTargets.map(({ target, index }) => (
            <TargetEditor
              key={`${target.id}-${index}`}
              index={index}
              target={target}
              groups={preset.blogGroups}
              isOpen={openTargetIds.includes(target.id)}
              isFirst={index === 0}
              isLast={index === preset.targets.length - 1}
              onChange={handleTargetChange}
              onRemove={handleTargetRemove}
              onToggleOpen={handleTargetToggleOpen}
              onDuplicate={handleTargetDuplicate}
              onMove={handleTargetMove}
            />
          ))}

          {preset.targets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-soft)]">
              아직 대상이 없음. 아래에서 하나 추가하고 읽기 시트를 지정하면 됨
            </p>
          ) : null}

          {preset.targets.length > 0 && visibleTargets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-soft)]">
              &quot;{query}&quot;에 걸리는 대상이 없음
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleTargetAdd}>
            <Plus className="size-3.5" />
            대상 추가
          </Button>
          {hiddenCount > 0 ? (
            <span className="text-[12px] text-[var(--ink-faint)]">
              검색으로 {hiddenCount}개 숨김
            </span>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="알림"
          description="비우면 서버 기본 웹훅으로 보냄"
        />
        <label className="flex flex-col gap-1.5">
          <span className="stamp">Dooray 웹훅</span>
          <input
            value={preset.doorayWebhookUrl ?? ''}
            onChange={handleWebhookChange}
            placeholder="https://hook.dooray.com/services/..."
            className={cn(
              'w-full rounded border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2',
              'tabular text-[13px] text-[var(--ink)] outline-none transition-colors',
              'placeholder:text-[var(--ink-faint)]',
              'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
            )}
          />
        </label>
      </Card>
    </div>
  );
};
