import React from 'react';
import { cn } from '@/shared/lib/cn';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

const TONE_BAR: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'bg-[var(--line)]',
  success: 'bg-[var(--live)]',
  warning: 'bg-[var(--hold)]',
  danger: 'bg-[var(--alert)]',
};

/** 계기판 한 칸. 왼쪽 색 바가 상태를, 모노 숫자가 값을 읽게 한다. */
export const StatCard = ({ label, value, hint, tone = 'neutral' }: StatCardProps) => {
  return (
    <div className="flex gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
      <span className={cn('w-0.5 shrink-0 rounded-full', TONE_BAR[tone])} />
      <div className="min-w-0">
        <p className="stamp">{label}</p>
        <p className="tabular mt-1.5 truncate text-[19px] font-semibold text-[var(--ink)]">
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 truncate text-xs text-[var(--ink-faint)]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
};
