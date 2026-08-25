import { NextResponse, type NextRequest } from 'next/server';
import { InvalidJobInputError, JobConflictError } from '@/server/job-errors';
import { startJob } from '@/server/job-runner';
import {
  canMemberRunJob,
  getSuiteTargetIdsForPreset,
} from '@/server/member-jobs';
import { readSessionMember } from '@/server/session-member';

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

  let member;
  try {
    member = await readSessionMember(request);
  } catch (error) {
    console.error('실행 전 세션 확인 실패', error);
    return NextResponse.json({ error: '실행하지 못함' }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요함' }, { status: 401 });
  }

  // 목록에서 숨기는 것만으로는 부족하다. 요청은 직접 만들어 보낼 수 있다.
  if (!canMemberRunJob(member.preset, jobId)) {
    return NextResponse.json(
      { error: '이 계정에서 돌릴 수 없는 항목임' },
      { status: 403 },
    );
  }

  try {
    const input = await parseRequestInput(request);
    const run = startJob(jobId, input, {
      tenantLoginId: member.loginId,
      allowedTargets: getSuiteTargetIdsForPreset(member.preset),
    });
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
