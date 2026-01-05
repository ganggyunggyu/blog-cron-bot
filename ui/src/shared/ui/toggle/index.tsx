import React from 'react';
import { cn } from '@/shared/lib/cn';

interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const Toggle = ({
  className,
  label,
  description,
  checked,
  ...props
}: ToggleProps) => {
  return (
    <React.Fragment>
      <label
        className={cn(
          'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3',
          className
        )}
      >
        <span className={cn('flex flex-col gap-1 text-sm font-semibold text-[var(--ink-1)]')}>
          {label}
          {description ? (
            <span className={cn('text-xs font-normal text-[var(--ink-2)]')}>{description}</span>
          ) : null}
        </span>
        <span
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full border transition',
            checked ? 'border-transparent bg-[var(--accent-1)]' : 'border-[var(--border)] bg-white'
          )}
        >
          <input
            type="checkbox"
            checked={checked}
            className={cn('absolute inset-0 cursor-pointer opacity-0')}
            {...props}
          />
          <span
            className={cn(
              'inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition',
              checked && 'translate-x-5'
            )}
          />
        </span>
      </label>
    </React.Fragment>
  );
};
