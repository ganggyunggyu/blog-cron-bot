import React from 'react';
import { cn } from '@/shared/lib/cn';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export const Card = ({ className, children }: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-3xl border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow)]',
        className
      )}
    >
      {children}
    </div>
  );
};
