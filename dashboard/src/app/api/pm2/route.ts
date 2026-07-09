import { NextResponse } from 'next/server';
import { getDaemonStatuses } from '@/server/pm2-client';

export const GET = async () => {
  try {
    const daemons = await getDaemonStatuses();
    return NextResponse.json({ daemons });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PM2 조회 실패' },
      { status: 502 },
    );
  }
};
