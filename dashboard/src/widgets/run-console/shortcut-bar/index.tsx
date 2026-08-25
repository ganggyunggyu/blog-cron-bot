import React from 'react';
import { Play, Plus } from 'lucide-react';
import type { ResolvedRunBundle } from '@/entities/job';
import { Button } from '@/shared';

interface ShortcutBarProps {
  bundles: ResolvedRunBundle[];
  targetLabels: ReadonlyMap<string, string>;
  canRunAll: boolean;
  isBusy: boolean;
  onRunAll: () => void;
  onRunBundle: (bundle: ResolvedRunBundle) => void;
}

interface BundleButtonProps {
  bundle: ResolvedRunBundle;
  targetLabels: ReadonlyMap<string, string>;
  isBusy: boolean;
  onRun: (bundle: ResolvedRunBundle) => void;
}

const BundleButton = ({
  bundle,
  targetLabels,
  isBusy,
  onRun,
}: BundleButtonProps) => {
  const handleClick = () => onRun(bundle);
  const isEmpty = bundle.targets.length === 0;
  // 빠진 대상은 개수가 아니라 이름으로 적는다. "2개 빠짐"은 무엇이 빠졌는지 알려주지 않는다.
  const droppedLabels = bundle.droppedTargets.map(
    (id) => targetLabels.get(id) ?? id,
  );

  return (
    <span className="inline-flex flex-col gap-0.5">
      <Button
        size="sm"
        variant="secondary"
        disabled={isBusy || isEmpty}
        title={isEmpty ? '이 묶음의 체크가 모두 꺼져 있습니다' : undefined}
        onClick={handleClick}
      >
        <Play className="size-3.5" />
        {bundle.label}
        <span className="tabular text-[11px] text-[var(--ink-faint)]">
          {bundle.targets.length}
        </span>
      </Button>
      {droppedLabels.length > 0 ? (
        <span className="text-[10px] text-[var(--hold)]">
          꺼둔 체크 빠짐: {droppedLabels.join(', ')}
        </span>
      ) : null}
    </span>
  );
};

export const ShortcutBar = ({
  bundles,
  targetLabels,
  canRunAll,
  isBusy,
  onRunAll,
  onRunBundle,
}: ShortcutBarProps) => (
  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-5 py-2.5">
    <Button size="sm" disabled={!canRunAll || isBusy} onClick={onRunAll}>
      <Play className="size-3.5" />
      전체 실행
    </Button>

    {bundles.map((bundle) => (
      <BundleButton
        key={bundle.id}
        bundle={bundle}
        targetLabels={targetLabels}
        isBusy={isBusy}
        onRun={onRunBundle}
      />
    ))}

    {/* 묶음이 없어도 이 줄을 그린다. 없을 때 통째로 숨기면 이런 기능이 있는 줄도 모른다. */}
    {bundles.length === 0 ? (
      <span className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
        <Plus className="size-3" />
        아래에서 체크를 고르고 묶음으로 저장하면 여기에 버튼이 생깁니다
      </span>
    ) : null}
  </div>
);
