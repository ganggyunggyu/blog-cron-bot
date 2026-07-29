'use client';

import React from 'react';
import { cn } from '@/shared';
import { AccountManager } from '@/widgets/account-manager';
import { PresetManager } from '@/widgets/preset-manager';

const TABS = [
  { id: 'preset', label: '노출체크 프리셋' },
  { id: 'accounts', label: '관리 계정 목록' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export const SettingsWorkspace = () => {
  const [tab, setTab] = React.useState<TabId>('preset');

  const handleTabClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.dataset.tab as TabId | undefined;
    if (next) setTab(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-tab={id}
            aria-selected={tab === id}
            onClick={handleTabClick}
            className={cn(
              'flex-1 rounded px-3 py-2 text-[13px] font-medium transition-colors',
              tab === id
                ? 'bg-[var(--signal)] text-[var(--signal-ink)]'
                : 'text-[var(--ink-soft)] hover:bg-[var(--line)]/40',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/*
        탭을 옮겨도 저장 안 한 프리셋 초안이 날아가면 안 되므로
        언마운트하지 않고 감추기만 한다.
      */}
      <div className={cn(tab === 'preset' ? 'block' : 'hidden')}>
        <PresetManager />
      </div>
      <div className={cn(tab === 'accounts' ? 'block' : 'hidden')}>
        <AccountManager />
      </div>
    </div>
  );
};
