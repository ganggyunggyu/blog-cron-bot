import { NextResponse } from 'next/server';
import { JOB_REGISTRY } from '@/server/job-registry';
import { isJobActive, isJobBlocked } from '@/server/job-runner';

export const GET = async () => {
  const jobs = JOB_REGISTRY.map(({
    id,
    label,
    description,
    riskNote,
    kind,
    options,
    executionMode,
  }) => {
    const isBlocked = isJobBlocked(id);
    return {
      id,
      label,
      description,
      riskNote,
      kind,
      options,
      executionMode,
      isRunning: isJobActive(id),
      isBlocked,
      blockReason: isBlocked ? '다른 노출체크가 실행 중임' : undefined,
    };
  });
  return NextResponse.json({ jobs });
};
