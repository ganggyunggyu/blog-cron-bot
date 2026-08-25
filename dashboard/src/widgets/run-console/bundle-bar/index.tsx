import React from 'react';
import { Play } from 'lucide-react';
import type { ResolvedRunBundle } from '@/entities/job';
import { Button } from '@/shared';

interface BundleBarProps {
  bundles: ResolvedRunBundle[];
  disabled: boolean;
  onRun: (bundle: ResolvedRunBundle) => void;
}

interface BundleButtonProps {
  bundle: ResolvedRunBundle;
  disabled: boolean;
  onRun: (bundle: ResolvedRunBundle) => void;
}

const BundleButton = ({ bundle, disabled, onRun }: BundleButtonProps) => {
  const handleClick = () => onRun(bundle);
  // 묶어둔 대상이 전부 꺼졌으면 누를 게 없다. 사라지게 두면 왜 없어졌는지 모른다.
  const isEmpty = bundle.targets.length === 0;

  return (
    <span className="inline-flex flex-col gap-0.5">
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || isEmpty}
        title={
          isEmpty
            ? '이 묶음의 대상이 모두 꺼져 있음'
            : `${bundle.targets.length}개 시트${bundle.maxPages ? ` · ${bundle.maxPages}페이지` : ''}`
        }
        onClick={handleClick}
      >
        <Play className="size-3.5" />
        {bundle.label}
        <span className="tabular text-[11px] text-[var(--ink-faint)]">
          {bundle.targets.length}
        </span>
      </Button>
      {bundle.droppedTargets.length > 0 ? (
        <span className="text-[10px] text-[var(--hold)]">
          꺼둔 대상 {bundle.droppedTargets.length}개 빠짐
        </span>
      ) : null}
    </span>
  );
};

/** 저장해둔 조합을 버튼 하나로 돌린다. 없으면 아무것도 그리지 않는다. */
export const BundleBar = ({ bundles, disabled, onRun }: BundleBarProps) => {
  if (bundles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3">
      <span className="mr-1 text-xs text-[var(--ink-faint)]">내 묶음</span>
      {bundles.map((bundle) => (
        <BundleButton
          key={bundle.id}
          bundle={bundle}
          disabled={disabled}
          onRun={onRun}
        />
      ))}
    </div>
  );
};
