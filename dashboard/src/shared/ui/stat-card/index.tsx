import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

const DOT_TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'hidden',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export const StatCard = ({ icon: Icon, label, value, hint, tone = 'neutral' }: StatCardProps) => {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-neutral-800 dark:bg-neutral-900">
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <Icon className="size-5" />
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-white dark:ring-neutral-900',
            DOT_TONE[tone],
          )}
        />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="truncate text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {value}
        </p>
        {hint ? (
          <p className="truncate text-xs text-neutral-400 dark:text-neutral-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );
};
