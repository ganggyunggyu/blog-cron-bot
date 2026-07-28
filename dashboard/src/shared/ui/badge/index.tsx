import React from 'react';
import { cn } from '@/shared/lib/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  withDot?: boolean;
}

const TONE_STYLE: Record<NonNullable<BadgeProps['tone']>, string> = {
  success: 'text-[var(--live)] border-[var(--live)]/30 bg-[var(--live)]/8',
  warning: 'text-[var(--hold)] border-[var(--hold)]/30 bg-[var(--hold)]/8',
  danger: 'text-[var(--alert)] border-[var(--alert)]/30 bg-[var(--alert)]/8',
  neutral: 'text-[var(--ink-soft)] border-[var(--line)] bg-transparent',
};

const DOT_STYLE: Record<NonNullable<BadgeProps['tone']>, string> = {
  success: 'bg-[var(--live)]',
  warning: 'bg-[var(--hold)]',
  danger: 'bg-[var(--alert)]',
  neutral: 'bg-[var(--ink-faint)]',
};

export const Badge = ({
  tone = 'neutral',
  withDot = false,
  className,
  children,
  ...props
}: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium',
        TONE_STYLE[tone],
        className,
      )}
      {...props}
    >
      {withDot ? (
        <span className={cn('size-1.5 shrink-0 rounded-full', DOT_STYLE[tone])} />
      ) : null}
      {children}
    </span>
  );
};
