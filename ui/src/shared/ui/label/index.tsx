import React from 'react';
import { cn } from '@/shared/lib/cn';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  hint?: string;
}

export const Label = ({ className, hint, children, ...props }: LabelProps) => {
  return (
    <label
      className={cn('flex flex-col gap-1 text-xs font-semibold text-[var(--ink-2)]', className)}
      {...props}
    >
      <span className={cn('text-[var(--ink-1)]')}>{children}</span>
      {hint ? <span className={cn('text-[11px] text-[var(--ink-2)]')}>{hint}</span> : null}
    </label>
  );
};
