import { NextResponse } from 'next/server';
import { JOB_REGISTRY } from '@/server/job-registry';
import { isJobActive } from '@/server/job-runner';

export const GET = async () => {
  const jobs = JOB_REGISTRY.map((job) => ({ ...job, isRunning: isJobActive(job.id) }));
  return NextResponse.json({ jobs });
};
