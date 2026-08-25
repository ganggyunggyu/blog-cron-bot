import { NextResponse, type NextRequest } from 'next/server';
import { InvalidJobInputError, JobConflictError } from '@/server/job-errors';
import { startJob } from '@/server/job-runner';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

const parseRequestInput = async (request: NextRequest): Promise<unknown> => {
  const body = await request.text();
  if (!body.trim()) return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new InvalidJobInputError('보낸 내용의 형식이 잘못됨');
  }
};

export const POST = async (request: NextRequest, { params }: RouteParams) => {
  const { jobId } = await params;

  try {
    const input = await parseRequestInput(request);
    const run = startJob(jobId, input);
    return NextResponse.json({ runId: run.runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '실행에 실패함';
    if (error instanceof InvalidJobInputError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof JobConflictError) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error('실행 중 예상하지 못한 오류가 발생함', error);
    return NextResponse.json(
      { error: '실행 중 서버에서 오류가 남' },
      { status: 500 },
    );
  }
};
