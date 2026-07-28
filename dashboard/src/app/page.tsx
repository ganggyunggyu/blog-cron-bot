import React from 'react';
import Link from 'next/link';
import { LogoutButton } from '@/features/auth-login';
import { DaemonStatusPanel } from '@/widgets/daemon-status-panel';
import { ExposureSuitePanel } from '@/widgets/exposure-suite-panel';
import { JobRunnerPanel } from '@/widgets/job-runner-panel';
import { LiveLogViewer } from '@/widgets/live-log-viewer';
import { OutputBrowser } from '@/widgets/output-browser';
import { OverviewStats } from '@/widgets/overview-stats';

const HomePage = () => {
  return (
    <div className="min-h-screen flex-1 bg-[var(--paper)]">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
              노출지기
            </span>
            <span className="stamp hidden sm:inline">Exposure Monitor</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/settings"
              className="rounded-md px-3 py-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--line)]/40 hover:text-[var(--ink)]"
            >
              계정 관리
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-7">
        <OverviewStats />
        <ExposureSuitePanel />
        <LiveLogViewer />
        <div className="grid gap-5 lg:grid-cols-2">
          <JobRunnerPanel />
          <DaemonStatusPanel />
        </div>
        <OutputBrowser />
      </main>
    </div>
  );
};

export default HomePage;
