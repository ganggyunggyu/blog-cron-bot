import React from 'react';
import { LogoutButton } from '@/features/auth-login';
import { DaemonStatusPanel } from '@/widgets/daemon-status-panel';
import { JobRunnerPanel } from '@/widgets/job-runner-panel';
import { LiveLogViewer } from '@/widgets/live-log-viewer';
import { OutputBrowser } from '@/widgets/output-browser';
import { SchedulerOverview } from '@/widgets/scheduler-overview';

const HomePage = () => {
  return (
    <div className="min-h-screen flex-1 bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            blog-cron-bot 대시보드
          </h1>
          <LogoutButton />
        </header>
        <DaemonStatusPanel />
        <SchedulerOverview />
        <JobRunnerPanel />
        <LiveLogViewer />
        <OutputBrowser />
      </div>
    </div>
  );
};

export default HomePage;
