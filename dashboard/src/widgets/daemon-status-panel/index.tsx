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

/** pm2가 주는 상태 원문(not_found, waiting_restart)을 그대로 보여주지 않는다. */
const STATUS_LABELS: Record<string, string> = {
  online: '켜짐',
  stopped: '꺼짐',
  stopping: '끄는 중',
  errored: '오류',
  launching: '켜는 중',
  waiting_restart: '재시작 대기',
  not_found: '등록 안 됨',
  unknown: '알 수 없음',
};

const DAEMON_LABELS: Record<string, string> = {
  'blog-cron-direct-check-8am': '패키지/일반건/도그마루/루트 노출체크',
  'blog-cron-more-check-830am': '더보기 노출체크',
};

/*
 * 시각을 여기 적어두면 안 된다.
 *
 * 이 라벨은 프로세스 상태와 무관하게 찍혀서, 스케줄러가 배포에서 빠진 뒤에도
 * "매일 08:00"이 계속 보였다. 지금 ecosystem.railway.config.cjs에 등록된 앱은
 * 대시보드와 워커 둘뿐이고 cron_restart도 없다 - 즉 자동 실행은 없다.
 * 시각은 pm2가 실제로 들고 있는 값에서만 읽는다.
 */
const describeSchedule = (daemon: DaemonStatus): string => {
  if (daemon.status === 'not_found') return '등록되어 있지 않습니다. 지금은 직접 눌러야 돕니다';
  if (daemon.cronRestart) return `자동 실행 ${daemon.cronRestart}`;
  return '자동 실행 설정이 없습니다';
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
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--line)] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-[var(--ink)]">
          {DAEMON_LABELS[daemon.name] ?? daemon.name}
        </span>
        <Badge withDot tone={STATUS_TONE[daemon.status] ?? 'neutral'}>
          {STATUS_LABELS[daemon.status] ?? daemon.status}
        </Badge>
      </div>
      {/*
        restarts는 pm2의 restart_time이라 "몇 번 실행됐나"가 아니라 "몇 번 재시작됐나"다.
        실행 횟수로 적어두면 매일 도는 횟수인 줄 읽게 된다.
        PID는 이 화면에서 할 수 있는 게 없어 뺐다.
      */}
      <p className="text-xs leading-5 text-[var(--ink-soft)]">
        {describeSchedule(daemon)}
        {daemon.status === 'not_found'
          ? null
          : ` · 켜진 지 ${formatUptime(daemon.uptimeMs)} · 메모리 ${formatBytes(daemon.memoryBytes)} · 재시작 ${daemon.restarts ?? '-'}회`}
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
      <SectionHeader
        title="자동 실행 스케줄"
        description="정해진 시간에 자동으로 도는 노출체크입니다"
      />
      {isLoading ? (
        <p className="text-sm text-[var(--ink-soft)]">불러오는 중</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-[var(--alert)]">
          {error instanceof Error ? error.message : '스케줄러 상태를 불러오지 못했습니다'}
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
