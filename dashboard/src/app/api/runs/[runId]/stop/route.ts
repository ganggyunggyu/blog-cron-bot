import { NextResponse, type NextRequest } from 'next/server';
import { stopRun } from '@/server/job-runner';

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export const POST = async (_request: NextRequest, { params }: RouteParams) => {
  const { runId } = await params;

  try {
    stopRun(runId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '정지 실패' },
      { status: 409 },
    );
  }
};
