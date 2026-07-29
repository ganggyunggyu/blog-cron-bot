import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { SettingsWorkspace } from '@/widgets/settings-workspace';

const SettingsPage = () => {
  return (
    <div className="min-h-screen flex-1 bg-transparent">
      <header className="sticky top-0 z-20 border-b border-[var(--line)]/80 bg-[var(--panel)]/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-800 text-white">
              <Settings className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight text-[var(--ink)]">
                노출체크 설정
              </h1>
              <p className="text-xs text-[var(--ink-soft)]">
                프리셋과 블로그 계정을 여기서 잡으면 다음 실행부터 반영됨
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

      <main className="mx-auto max-w-5xl px-6 py-6">
        <SettingsWorkspace />
      </main>
    </div>
  );
};

export default SettingsPage;
