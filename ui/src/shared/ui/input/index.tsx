import React from 'react';
import { cn } from '@/shared/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endSlot?: React.ReactNode;
}

export const Input = ({
  className,
  startIcon,
  endSlot,
  type = 'text',
  ...props
}: InputProps) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5',
        'transition focus-within:border-[var(--accent-1)] focus-within:ring-2 focus-within:ring-[var(--ring)]',
        className
      )}
    >
      {startIcon ? (
        <span className={cn('text-[var(--ink-2)]')}>{startIcon}</span>
      ) : null}
      <input
        type={type}
        className={cn(
          'w-full bg-transparent text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-2)]',
          'focus:outline-none'
        )}
        {...props}
      />
      {endSlot ? <span>{endSlot}</span> : null}
    </div>
  );
};
