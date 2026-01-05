import React from 'react';
import { cn } from '@/shared/lib/cn';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export const Badge = ({ className, variant = 'neutral', children }: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
        variant === 'neutral' && 'bg-black/5 text-[var(--ink-1)]',
        variant === 'success' && 'bg-emerald-100 text-emerald-700',
        variant === 'warning' && 'bg-amber-100 text-amber-700',
        variant === 'danger' && 'bg-rose-100 text-rose-700',
        className
      )}
    >
      {children}
    </span>
  );
};
