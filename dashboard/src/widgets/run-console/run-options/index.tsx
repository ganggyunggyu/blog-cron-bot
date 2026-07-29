import React from 'react';
import type { ExposureTargetDefinition, ExposureTargetId } from '@/entities/job';
import { cn } from '@/shared';

interface TargetOptionProps {
  target: ExposureTargetDefinition;
  isSelected: boolean;
  onToggle: (targetId: ExposureTargetId) => void;
}

export const TargetOption = ({ target, isSelected, onToggle }: TargetOptionProps) => {
  const handleChange = () => onToggle(target.id);

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors',
        'focus-within:ring-2 focus-within:ring-[var(--signal)]/30',
        isSelected
          ? 'border-[var(--signal)]/50 bg-[var(--signal)]/10'
          : 'border-[var(--line)] hover:border-[var(--ink-faint)]',
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleChange}
        className="size-4 shrink-0 accent-[var(--signal)]"
      />
      <span className="truncate text-[13px] font-medium text-[var(--ink)]">
        {target.label}
      </span>
    </label>
  );
};

interface NumberOptionProps {
  label: string;
  description: string;
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
}

export const NumberOption = ({
  label,
  description,
  min,
  max,
  value,
  onChange,
}: NumberOptionProps) => {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <label className="flex items-center justify-between gap-4 rounded-md border border-[var(--line)] px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--ink)]">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--ink-faint)]">
          {description}
        </span>
      </span>
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={handleChange}
        className={cn(
          'tabular h-9 w-16 shrink-0 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm text-[var(--ink)]',
          'outline-none transition-colors focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25',
        )}
      >
        {values.map((optionValue) => (
          <option key={optionValue} value={optionValue}>
            {optionValue}
          </option>
        ))}
      </select>
    </label>
  );
};
