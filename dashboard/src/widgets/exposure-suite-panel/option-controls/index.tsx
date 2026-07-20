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
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all',
        'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
        isSelected
          ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/50'
          : 'border-neutral-200 bg-white/80 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900/70',
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleChange}
        className={cn('mt-0.5 size-4 rounded border-neutral-300 accent-blue-600')}
      />
      <span className={cn('min-w-0')}>
        <span className={cn('block text-sm font-semibold text-neutral-900 dark:text-neutral-100')}>
          {target.label}
        </span>
        <span className={cn('mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400')}>
          {target.description}
        </span>
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

export const NumberOption = ({ label, description, min, max, value, onChange }: NumberOptionProps) => {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <label className={cn('flex items-center justify-between gap-4 rounded-lg bg-white/70 p-3 dark:bg-neutral-900/60')}>
      <span>
        <span className={cn('block text-sm font-medium text-neutral-800 dark:text-neutral-200')}>
          {label}
        </span>
        <span className={cn('mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400')}>
          {description}
        </span>
      </span>
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={handleChange}
        className={cn(
          'min-h-10 w-20 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold',
          'outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
          'dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100',
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
