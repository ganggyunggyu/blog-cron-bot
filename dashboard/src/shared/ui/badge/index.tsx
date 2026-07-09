import React from 'react';
import { cn } from '@/shared/lib/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}

export const Badge = ({ tone = 'neutral', className, ...props }: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'success' &&
          'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        tone === 'warning' &&
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        tone === 'danger' &&
          'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        tone === 'neutral' &&
          'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
        className,
      )}
      {...props}
    />
  );
};
