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

const ICON_TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const StatCard = ({ icon: Icon, label, value, hint, tone = 'neutral' }: StatCardProps) => {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-neutral-800 dark:bg-neutral-900">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', ICON_TONE[tone])}>
        <Icon className="size-5" />
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
