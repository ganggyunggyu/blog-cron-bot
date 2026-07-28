'use client';

import React from 'react';
import { Plus } from 'lucide-react';
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
  removeGroupAt,
  replaceGroup,
  replaceTarget,
  toSavablePreset,
} from './model';

const toErrorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? fallback;
};

export const PresetManager = () => {
  const { data, isLoading, error } = usePreset();
  const { mutate, isPending, error: saveError, isSuccess } = useSavePreset();
  const [draft, setDraft] = React.useState<TenantPreset | null>(null);

  const serverPreset = data?.preset ?? null;
  const preset = draft ?? serverPreset;
  const isDirty =
    draft !== null &&
    serverPreset !== null &&
    JSON.stringify(toSavablePreset(draft)) !==
      JSON.stringify(toSavablePreset(serverPreset));

  const handleTargetChange = (index: number, next: PresetTarget) => {
    if (!preset) return;
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
    setDraft({
      ...preset,
      targets: [...preset.targets, createEmptyTarget(preset.targets)],
    });
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
    setDraft({
      ...preset,
      blogGroups: [...preset.blogGroups, createEmptyGroup(preset.blogGroups)],
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

  return (
    <Card>
      <SectionHeader
        title="노출체크 프리셋"
        description="대상마다 읽는 시트와 쓰는 시트를 따로 잡음. 아직 저장까지만 되고, 실행은 코드 기본값을 봄"
        action={
          <div className="flex items-center gap-2">
            <Badge tone={isDirty ? 'warning' : 'neutral'}>
              {isDirty ? '저장 안 됨' : `대상 ${enabledCount}/${preset.targets.length}`}
            </Badge>
            {data?.member ? (
              <Badge tone="neutral">{data.member.displayName}</Badge>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-1.5">
        <span className="stamp">Dooray 웹훅 (비우면 서버 기본값)</span>
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
      </div>

      <div className="mb-5 rounded-lg border border-[var(--line)] p-3">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <span className="stamp">계정 그룹</span>
          <span className="text-[12px] text-[var(--ink-soft)]">
            준최, 최블처럼 묶어두고 대상마다 골라 더해 씀
          </span>
        </div>
        <GroupEditor
          groups={preset.blogGroups}
          usedCountByGroupId={countGroupUsage(preset.targets)}
          onChange={handleGroupChange}
          onRemove={handleGroupRemove}
          onAdd={handleGroupAdd}
        />
      </div>

      <div className="flex flex-col gap-3">
        {preset.targets.map((target, index) => (
          <TargetEditor
            key={`${target.id}-${index}`}
            index={index}
            target={target}
            groups={preset.blogGroups}
            onChange={handleTargetChange}
            onRemove={handleTargetRemove}
          />
        ))}
        {preset.targets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-soft)]">
            아직 대상이 없음. 아래에서 하나 추가하고 읽기 시트를 지정하면 됨
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleTargetAdd}>
          <Plus className="size-3.5" />
          대상 추가
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!isDirty || isPending}>
          {isPending ? '저장 중' : '프리셋 저장'}
        </Button>
        {isDirty ? (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            되돌리기
          </Button>
        ) : null}
        {saveError ? (
          <span className="text-[12px] text-[var(--alert)]">
            {toErrorMessage(saveError, '프리셋을 저장하지 못함')}
          </span>
        ) : null}
        {isSuccess && !isDirty ? (
          <span className="text-[12px] text-[var(--live)]">저장됨</span>
        ) : null}
      </div>
    </Card>
  );
};
