import { NextResponse, type NextRequest } from 'next/server';
import { startJob } from '@/server/job-runner';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export const POST = async (_request: NextRequest, { params }: RouteParams) => {
  const { jobId } = await params;

  try {
    const run = startJob(jobId);
    return NextResponse.json({ runId: run.runId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '잡 실행 실패' },
      { status: 409 },
    );
  }
};
