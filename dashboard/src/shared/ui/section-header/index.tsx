import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}: SectionHeaderProps) => {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
};
