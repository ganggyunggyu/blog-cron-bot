import React from 'react';
import { cn } from '@/shared/lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-[background-color,transform,opacity] active:translate-y-px',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40 focus-visible:ring-offset-2',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        variant === 'primary' &&
          'bg-[var(--signal)] text-[var(--signal-ink)] hover:opacity-90',
        variant === 'secondary' &&
          'border border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--line)]/40',
        variant === 'danger' &&
          'border border-[var(--alert)]/40 bg-transparent text-[var(--alert)] hover:bg-[var(--alert)]/10',
        variant === 'ghost' &&
          'bg-transparent text-[var(--ink-soft)] hover:bg-[var(--line)]/40 hover:text-[var(--ink)]',
        className,
      )}
      {...props}
    />
  );
};
