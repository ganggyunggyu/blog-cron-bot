import React from 'react';
import { cn } from '@/shared/lib/cn';

type ButtonVariant = 'primary' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button = ({
  className,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  children,
  disabled,
  ...props
}: ButtonProps) => {
  const isDisabled = disabled || isLoading;

  return (
    <React.Fragment>
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full border font-semibold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          variant === 'primary' &&
            'border-transparent bg-[var(--accent-1)] text-white shadow-[0_12px_30px_rgba(15,118,110,0.35)] hover:-translate-y-0.5',
          variant === 'outline' &&
            'border-[var(--border)] bg-white/70 text-[var(--ink-1)] hover:bg-white',
          variant === 'ghost' &&
            'border-transparent bg-transparent text-[var(--ink-1)] hover:bg-black/5',
          size === 'sm' && 'px-4 py-2 text-sm',
          size === 'md' && 'px-5 py-2.5 text-sm',
          size === 'lg' && 'px-6 py-3 text-base',
          isDisabled && 'pointer-events-none opacity-60',
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {isLoading ? (
          <span
            className={cn(
              'h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white'
            )}
          />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {rightIcon}
      </button>
    </React.Fragment>
  );
};
