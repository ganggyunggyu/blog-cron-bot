'use client';

import React from 'react';
import { Play, RotateCw, Square } from 'lucide-react';
import { Badge, Button, Card, SectionHeader, cn, formatBytes, formatUptime } from '@/shared';
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
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-[var(--ink)]">
          {DAEMON_LABELS[daemon.name] ?? daemon.name}
        </span>
        <Badge withDot tone={STATUS_TONE[daemon.status] ?? 'neutral'}>
          {daemon.status}
        </Badge>
      </div>
      <p className="text-xs leading-5 text-[var(--ink-soft)]">
        {DAEMON_SCHEDULE_LABELS[daemon.name] ?? '-'} 실행 · PID {daemon.pid ?? '-'} · 가동{' '}
        {formatUptime(daemon.uptimeMs)} · 메모리 {formatBytes(daemon.memoryBytes)} · 실행 횟수{' '}
        {daemon.restarts ?? '-'}회
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={isOnline || isBusy} onClick={() => handleAction('start')}>
          <Play className="size-3.5" />
          시작
        </Button>
        <Button size="sm" variant="danger" disabled={!isOnline || isBusy} onClick={() => handleAction('stop')}>
          <Square className="size-3.5" />
          중지
        </Button>
        <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => handleAction('restart')}>
          <RotateCw className={cn('size-3.5', isBusy && 'animate-spin')} />
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
      <SectionHeader title="PM2 데몬 상태" description="예약 스케줄러 프로세스 관리" />
      {isLoading ? (
        <p className="text-sm text-[var(--ink-soft)]">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-[var(--alert)]">
          {error instanceof Error ? error.message : 'PM2 상태를 불러오지 못함'}
        </p>
      ) : null}
      {data ? (
        <div className="flex flex-col gap-2.5">
          {data.map((daemon) => (
            <DaemonRow key={daemon.name} daemon={daemon} />
          ))}
        </div>
      ) : null}
    </Card>
  );
};
