import React from 'react';
import { cn } from '@/shared/lib/cn';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({ className, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5',
        className,
      )}
      {...props}
    />
  );
};
