import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { AccountManager } from '@/widgets/account-manager';

const SettingsPage = () => {
  return (
    <div className="min-h-screen flex-1 bg-transparent">
      <header className="sticky top-0 z-10 border-b border-[var(--line)]/80 bg-[var(--panel)]/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-800 text-white">
              <Settings className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight text-[var(--ink)]">
                노출체크 계정 관리
              </h1>
              <p className="text-xs text-[var(--ink-soft)]">
                여기서 추가·제거하면 다음 노출체크부터 바로 반영됨
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-[var(--line)]/40"
          >
            <ArrowLeft className="size-4" />
            대시보드
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <AccountManager />
      </main>
    </div>
  );
};

export default SettingsPage;
