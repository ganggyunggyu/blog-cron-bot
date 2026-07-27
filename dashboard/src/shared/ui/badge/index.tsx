import React from 'react';
import { cn } from '@/shared/lib/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  withDot?: boolean;
}

const DOT_TONE: Record<NonNullable<BadgeProps['tone']>, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-neutral-400',
};

export const Badge = ({ tone = 'neutral', withDot = false, className, children, ...props }: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'success' &&
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
        tone === 'warning' &&
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        tone === 'danger' &&
          'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        tone === 'neutral' &&
          'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
        className,
      )}
      {...props}
    >
      {withDot ? <span className={cn('size-1.5 shrink-0 rounded-full', DOT_TONE[tone])} /> : null}
      {children}
    </span>
  );
};
