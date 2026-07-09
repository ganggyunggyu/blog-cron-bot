import { NextResponse, type NextRequest } from 'next/server';
import {
  controlDaemon,
  isControllableDaemon,
  type DaemonAction,
} from '@/server/pm2-client';

const VALID_ACTIONS: DaemonAction[] = ['start', 'stop', 'restart'];

interface RouteParams {
  params: Promise<{ app: string; action: string }>;
}

export const POST = async (_request: NextRequest, { params }: RouteParams) => {
  const { app, action } = await params;

  if (!isControllableDaemon(app)) {
    return NextResponse.json({ error: '알 수 없는 데몬' }, { status: 404 });
  }
  if (!VALID_ACTIONS.includes(action as DaemonAction)) {
    return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
  }

  try {
    await controlDaemon(app, action as DaemonAction);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PM2 제어 실패' },
      { status: 502 },
    );
  }
};
