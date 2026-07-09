'use client';

import React from 'react';
import { Card } from '@/shared';
import { useSchedulerStates } from '@/entities/scheduler-state';

const getNextRunLabel = (runTimes: string[]): string => {
  if (runTimes.length === 0) return '-';
  const nowKst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();

  const sorted = [...runTimes].sort();
  const upcoming = sorted.find((time) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute > nowMinutes;
  });

  return upcoming ? `오늘 ${upcoming}` : `내일 ${sorted[0]}`;
};

const getLastRunLabel = (lastRunByTime: Record<string, string>): string => {
  const dates = Object.values(lastRunByTime);
  if (dates.length === 0) return '기록 없음';
  return [...dates].sort().at(-1) ?? '기록 없음';
};

export const SchedulerOverview = () => {
  const { data, isLoading, isError } = useSchedulerStates();

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        스케줄 현황
      </h2>
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">스케줄 상태를 불러오지 못함</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data?.map((scheduler) => (
          <div
            key={scheduler.key}
            className="rounded-md border border-neutral-100 p-3 dark:border-neutral-800"
          >
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {scheduler.label}
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              예정 시각: {scheduler.runTimes.join(', ')}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              마지막 실행일: {getLastRunLabel(scheduler.lastRunByTime)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              다음 실행(추정): {getNextRunLabel(scheduler.runTimes)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-400">
        실제 배포 환경변수(ecosystem.config.cjs)에 따라 다를 수 있는 추정값임.
      </p>
    </Card>
  );
};
