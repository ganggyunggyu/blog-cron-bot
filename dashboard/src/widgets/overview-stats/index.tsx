'use client';

import React from 'react';
import { StatCard } from '@/shared';
import { useJobList } from '@/entities/job';
import { useRunList } from '@/entities/run';
import { useOutputFileList } from '@/entities/output-file';
import { useDaemonStatusList } from '@/entities/pm2-process';

const RUN_STATUS_LABELS: Record<string, string> = {
  running: '실행 중',
  success: '성공',
  failed: '실패',
  stopped: '중지됨',
  unknown: '알 수 없음',
};

const RUN_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  running: 'warning',
  success: 'success',
  failed: 'danger',
  stopped: 'neutral',
  unknown: 'neutral',
};

export const OverviewStats = () => {
  const { data: daemons } = useDaemonStatusList();
  const { data: jobs } = useJobList();
  const { data: runs } = useRunList();
  const { data: outputs } = useOutputFileList();

  const onlineCount = daemons?.filter((daemon) => daemon.status === 'online').length ?? 0;
  const totalDaemons = daemons?.length ?? 0;
  const daemonTone = !daemons ? 'neutral' : onlineCount === totalDaemons ? 'success' : 'warning';

  const runningJobs = jobs?.filter((job) => job.isRunning) ?? [];
  const latestRun = runs?.[0];
  const latestRunTone = latestRun ? RUN_STATUS_TONE[latestRun.status] ?? 'neutral' : 'neutral';

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="PM2 데몬"
        value={daemons ? `${onlineCount}/${totalDaemons} 온라인` : '-'}
        hint="예약 스케줄러 상태"
        tone={daemonTone}
      />
      <StatCard
        label="실행 중인 작업"
        value={runningJobs.length > 0 ? `${runningJobs.length}건` : '없음'}
        hint={runningJobs.length > 0 ? runningJobs.map((job) => job.label).join(', ') : '대기 중'}
        tone={runningJobs.length > 0 ? 'warning' : 'neutral'}
      />
      <StatCard
        label="최근 실행 결과"
        value={latestRun ? RUN_STATUS_LABELS[latestRun.status] ?? latestRun.status : '기록 없음'}
        hint={latestRun?.jobLabel}
        tone={latestRunTone}
      />
      <StatCard
        label="결과 파일"
        value={outputs ? `${outputs.totalCount}개` : '-'}
        hint="output 폴더 누적 기준"
      />
    </div>
  );
};
