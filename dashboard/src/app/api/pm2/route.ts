import { NextResponse } from 'next/server';
import { getDaemonStatuses } from '@/server/pm2-client';

export const GET = async () => {
  try {
    const daemons = await getDaemonStatuses();
    return NextResponse.json({ daemons });
  } catch (error) {
    // pm2가 던지는 원문은 영어라 그대로 내려보내면 화면에 영어가 찍힌다.
    console.error('스케줄러 상태 조회 실패', error);
    return NextResponse.json(
      { error: '스케줄러에 연결하지 못함' },
      { status: 502 },
    );
  }
};
