'use client';

import React from 'react';
import { Play, RotateCw, Square } from 'lucide-react';
import { Badge, Button, Card, cn, formatBytes, formatUptime } from '@/shared';
import { useDaemonAction, useDaemonStatusList } from '@/entities/pm2-process';
import type { DaemonAction, DaemonStatus } from '@/entities/pm2-process';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  online: 'success',
  stopped: 'neutral',
  stopping: 'warning',
  errored: 'danger',
  launching: 'warning',
  waiting_restart: 'warning',
  not_found: 'danger',
  unknown: 'neutral',
};

const DAEMON_LABELS: Record<string, string> = {
  'blog-cron-direct-check-8am': '패키지/일반건/도그마루/루트 노출체크',
  'blog-cron-more-check-830am': '더보기 노출체크',
};

const DAEMON_SCHEDULE_LABELS: Record<string, string> = {
  'blog-cron-direct-check-8am': '매일 08:00',
  'blog-cron-more-check-830am': '매일 08:30',
};

interface DaemonRowProps {
  daemon: DaemonStatus;
}

const DaemonRow = ({ daemon }: DaemonRowProps) => {
  const { mutate, isPending, variables } = useDaemonAction();
  const isOnline = daemon.status === 'online';
  const isBusy = isPending && variables?.name === daemon.name;

  const handleAction = (action: DaemonAction) => {
    mutate({ name: daemon.name, action });
  };

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {DAEMON_LABELS[daemon.name] ?? daemon.name}
          </span>
          <Badge tone={STATUS_TONE[daemon.status] ?? 'neutral'}>{daemon.status}</Badge>
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {DAEMON_SCHEDULE_LABELS[daemon.name] ?? '-'} 실행 · PID {daemon.pid ?? '-'} · 가동{' '}
          {formatUptime(daemon.uptimeMs)} · 메모리 {formatBytes(daemon.memoryBytes)} · 실행 횟수{' '}
          {daemon.restarts ?? '-'}회
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={isOnline || isBusy}
          onClick={() => handleAction('start')}
        >
          <Play className="size-4" />
          시작
        </Button>
        <Button
          variant="danger"
          disabled={!isOnline || isBusy}
          onClick={() => handleAction('stop')}
        >
          <Square className="size-4" />
          중지
        </Button>
        <Button variant="secondary" disabled={isBusy} onClick={() => handleAction('restart')}>
          <RotateCw className={cn('size-4', isBusy && 'animate-spin')} />
          재시작
        </Button>
      </div>
    </div>
  );
};

export const DaemonStatusPanel = () => {
  const { data, isLoading, isError, error } = useDaemonStatusList();

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        PM2 데몬 상태
      </h2>
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'PM2 상태를 불러오지 못함'}
        </p>
      ) : null}
      {data ? (
        <div className="flex flex-col">
          {data.map((daemon) => (
            <DaemonRow key={daemon.name} daemon={daemon} />
          ))}
        </div>
      ) : null}
    </Card>
  );
};
