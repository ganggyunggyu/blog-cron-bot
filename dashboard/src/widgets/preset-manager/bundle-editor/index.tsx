import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { PresetTarget, RunBundle } from '@/entities/preset';
import { Button, cn } from '@/shared';

const MAX_PAGES = 9;

interface BundleEditorProps {
  bundle: RunBundle;
  /** 고를 수 있는 대상. 전체 실행에 뜨는 것과 같은 목록이다. */
  targets: PresetTarget[];
  onChange: (next: RunBundle) => void;
  onRemove: () => void;
}

/** 이름을 붙인 대상 조합 하나. 실행 화면에서 버튼 하나가 된다. */
export const BundleEditor = ({
  bundle,
  targets,
  onChange,
  onRemove,
}: BundleEditorProps) => {
  // 묶음마다 체크박스 11개를 펼쳐두면 묶음 셋만 있어도 설정 화면 위쪽이 전부
  // 체크박스로 덮인다. 평소에는 한 줄로 두고 편집할 때만 펼친다.
  const [isEditing, setIsEditing] = React.useState(false);
  const handleToggleEdit = () => setIsEditing((current) => !current);
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...bundle, label: event.target.value });
  };

  const handlePagesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onChange({
      ...bundle,
      maxPages: value === '' ? undefined : Number(value),
    });
  };

  const handleToggle = (targetId: string) => {
    onChange({
      ...bundle,
      targets: bundle.targets.includes(targetId)
        ? bundle.targets.filter((id) => id !== targetId)
        : [...bundle.targets, targetId],
    });
  };

  // 페이지 수는 애견·서리펫에만 먹는다. 그 대상이 없으면 물어볼 이유가 없다.
  const hasPageTarget = targets.some(
    ({ id, kind }) => bundle.targets.includes(id) && kind === 'page',
  );

  const summary = bundle.targets
    .map((id) => targets.find((target) => target.id === id)?.label ?? id)
    .join(', ');

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] px-3.5 py-2.5">
        <span className="text-[13px] font-medium text-[var(--ink)]">
          {bundle.label || '이름 없음'}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-soft)]">
          {summary || '고른 체크 없음'}
          {bundle.maxPages ? ` · ${bundle.maxPages}페이지` : ''}
        </span>
        <Button size="sm" variant="ghost" onClick={handleToggleEdit}>
          <Pencil className="size-3.5" />
          편집
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-3.5" />
          삭제
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--signal)]/40 p-3.5">
      <div className="flex items-center gap-2">
        <input
          value={bundle.label}
          onChange={handleLabelChange}
          placeholder="묶음 이름"
          aria-label="묶음 이름"
          className="h-8 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25"
        />
        <Button size="sm" variant="secondary" onClick={handleToggleEdit}>
          완료
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="size-3.5" />
          삭제
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {targets.map((target) => {
          const isSelected = bundle.targets.includes(target.id);
          const handleChange = () => handleToggle(target.id);
          return (
            <label
              key={target.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[12px] transition-colors',
                isSelected
                  ? 'border-[var(--signal)]/50 bg-[var(--signal)]/10 text-[var(--ink)]'
                  : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleChange}
                className="size-3.5 shrink-0 accent-[var(--signal)]"
              />
              <span className="truncate">{target.label}</span>
            </label>
          );
        })}
      </div>

      {hasPageTarget ? (
        <label className="flex items-center justify-between gap-3 text-[12px] text-[var(--ink-soft)]">
          <span>애견·서리펫 최대 페이지</span>
          <select
            value={bundle.maxPages ?? ''}
            onChange={handlePagesChange}
            aria-label="애견·서리펫 최대 페이지"
            className="tabular h-8 w-24 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--signal)]"
          >
            <option value="">기본값</option>
            {Array.from({ length: MAX_PAGES }, (_, index) => index + 1).map(
              (value) => (
                <option key={value} value={value}>
                  {value}페이지
                </option>
              ),
            )}
          </select>
        </label>
      ) : null}

      {bundle.targets.length === 0 ? (
        <p className="text-[11px] text-[var(--hold)]">
          대상을 하나도 안 고르면 저장할 때 빠집니다.
        </p>
      ) : null}
    </div>
  );
};
