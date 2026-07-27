import React from 'react';
import { cn } from '@/shared/lib/cn';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({ className, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-neutral-800 dark:bg-neutral-900',
        className,
      )}
      {...props}
    />
  );
};
