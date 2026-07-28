import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { AccountManager } from '@/widgets/account-manager';

const SettingsPage = () => {
  return (
    <div className="min-h-screen flex-1 bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/85 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-800 text-white dark:bg-neutral-700">
              <Settings className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
                노출체크 계정 관리
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                여기서 추가·제거하면 다음 노출체크부터 바로 반영됨
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
