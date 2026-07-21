import React from 'react';
import { Compass } from 'lucide-react';
import { LogoutButton } from '@/features/auth-login';
import { DaemonStatusPanel } from '@/widgets/daemon-status-panel';
import { ExposureSuitePanel } from '@/widgets/exposure-suite-panel';
import { JobRunnerPanel } from '@/widgets/job-runner-panel';
import { LiveLogViewer } from '@/widgets/live-log-viewer';
import { OutputBrowser } from '@/widgets/output-browser';
import { OverviewStats } from '@/widgets/overview-stats';

const HomePage = () => {
  return (
    <div className="min-h-screen flex-1 bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/85 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Compass className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
                노출지기 대시보드
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                네이버 노출체크 크론 봇 제어판
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <OverviewStats />
        <DaemonStatusPanel />
        <ExposureSuitePanel />
        <JobRunnerPanel />
        <LiveLogViewer />
        <OutputBrowser />
      </main>
    </div>
  );
};

export default HomePage;
