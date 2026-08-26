'use client';

import React from 'react';
import { Plus, RotateCcw, Save } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, cn } from '@/shared';
import {
  usePreset,
  useSavePreset,
  type BlogGroup,
  type RunBundle,
  type PresetTarget,
  type TenantPreset,
} from '@/entities/preset';
import { BundleEditor } from './bundle-editor';
import { GroupEditor } from './group-editor';
import { TargetEditor } from './target-editor';
import {
  countGroupUsage,
  createEmptyBundle,
  createEmptyGroup,
  removeBundleAt,
  removeGroupAt,
  replaceBundle,
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

  const handleBundleAdd = () => {
    if (!preset) return;
    const bundles = preset.runBundles ?? [];
    setDraft({ ...preset, runBundles: [...bundles, createEmptyBundle(bundles)] });
  };

  const handleBundleChange = (index: number, next: RunBundle) => {
    if (!preset) return;
    setDraft({
      ...preset,
      runBundles: replaceBundle(preset.runBundles ?? [], index, next),
    });
  };

  const handleBundleRemove = (index: number) => {
    if (!preset) return;
    setDraft({
      ...preset,
      runBundles: removeBundleAt(preset.runBundles ?? [], index),
    });
  };

  const handleWebhookChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!preset) return;
    setDraft({ ...preset, doorayWebhookUrl: event.target.value });
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
  // 봇이 base 계정을 package ?? general ?? root 순으로 고른다. package에 그룹이
  // 붙어 있으면 general/root에 붙인 계정은 쓰이지 않는다.
  const packageHasGroups = (
    preset.targets.find(({ id }) => id === 'package')?.blogGroupIds ?? []
  ).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'sticky top-[73px] z-10 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3',
          'bg-[var(--panel)]',
          isDirty ? 'border-[var(--hold)]/50' : 'border-[var(--line)]',
        )}
      >
        <Badge tone={isDirty ? 'warning' : 'success'} withDot>
          {isDirty ? '저장 안 됨' : '저장됨'}
        </Badge>
        <span className="tabular text-[12px] text-[var(--ink-soft)]">
          체크 {enabledCount}/{preset.targets.length} · 계정 그룹 {preset.blogGroups.length}
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
          title="실행 묶음"
          description="실행 화면에서 버튼 하나로 돌릴 조합입니다"
          action={
            <Button variant="ghost" size="sm" onClick={handleBundleAdd}>
              <Plus className="size-3.5" />
              묶음 추가
            </Button>
          }
        />
        {(preset.runBundles ?? []).length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">
            아직 만든 묶음이 없습니다. 예를 들어 &ldquo;아침 전체&rdquo;, &ldquo;애견만 9페이지&rdquo;처럼
            묶어두고 실행 화면에서 바로 누를 수 있습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {(preset.runBundles ?? []).map((bundle, index) => (
              <BundleEditor
                key={bundle.id}
                bundle={bundle}
                targets={preset.targets.filter(({ enabled }) => enabled)}
                onChange={(next) => handleBundleChange(index, next)}
                onRemove={() => handleBundleRemove(index)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="계정 그룹"
          description="체크마다 골라 쓰는 계정 묶음입니다"
          action={<Badge tone="success">실행에 반영됨</Badge>}
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
          title="노출체크 종류"
          description="켜고 끄는 것과 어떤 계정으로 볼지를 정합니다"
        />
        <div className="flex flex-col gap-2">
          {preset.targets.map((target, index) => (
            <TargetEditor
              key={target.id}
              target={target}
              groups={preset.blogGroups}
              index={index}
              isOpen={openTargetIds.includes(target.id)}
              packageHasGroups={packageHasGroups}
              onChange={handleTargetChange}
              onToggleOpen={handleTargetToggleOpen}
            />
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[var(--ink-faint)]">
          체크 종류는 정해져 있어 새로 만들 수 없습니다. 조합이 필요하면 실행 화면에서
          골라 묶음으로 저장하세요.
        </p>
      </Card>

      <Card>
        <SectionHeader
          title="알림"
          description="비워두면 기본 웹훅으로 보냅니다"
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
