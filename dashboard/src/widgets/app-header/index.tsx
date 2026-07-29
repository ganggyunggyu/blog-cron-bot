import React from 'react';
import Link from 'next/link';
import { LogoutButton } from '@/features/auth-login';
import { cn } from '@/shared';

const NAV_ITEMS = [
  { href: '/', label: '실행' },
  { href: '/activity', label: '기록' },
  { href: '/settings', label: '설정' },
];

interface AppHeaderProps {
  current: string;
  memberId?: string | null;
}

/** 세 화면이 같은 자리에서 같은 이동 경로를 갖게 한다. */
export const AppHeader = ({ current, memberId }: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            노출지기
          </span>
          {memberId ? <span className="stamp">{memberId}</span> : null}
        </div>

        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm transition-colors',
                current === item.href
                  ? 'bg-[var(--line)]/60 text-[var(--ink)]'
                  : 'text-[var(--ink-soft)] hover:bg-[var(--line)]/40 hover:text-[var(--ink)]',
              )}
            >
              {item.label}
            </Link>
          ))}
          <span className="ml-1">
            <LogoutButton />
          </span>
        </nav>
      </div>
    </header>
  );
};
