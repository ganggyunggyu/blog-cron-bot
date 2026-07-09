import { NextResponse } from 'next/server';
import { listRuns } from '@/server/job-runner';

export const GET = async () => {
  return NextResponse.json({ runs: listRuns() });
};
