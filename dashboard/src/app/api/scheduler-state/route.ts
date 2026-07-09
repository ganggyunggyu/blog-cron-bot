import { NextResponse } from 'next/server';
import { getSchedulerStates } from '@/server/scheduler-state';

export const GET = async () => {
  return NextResponse.json({ schedulers: getSchedulerStates() });
};
