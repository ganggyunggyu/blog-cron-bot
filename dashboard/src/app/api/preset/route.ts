import { NextResponse, type NextRequest } from 'next/server';
import { saveMemberPreset, type MemberAccount } from '@/server/member-auth';
import { parsePreset } from '@/server/preset';
import { readSessionMember } from '@/server/session-member';

const toPayload = ({ id, loginId, displayName, preset }: MemberAccount) => ({
  member: { id, loginId, displayName },
  preset,
});

const unauthorized = () =>
  NextResponse.json({ error: '로그인이 필요함' }, { status: 401 });

export const GET = async (request: NextRequest) => {
  try {
    const member = await readSessionMember(request);
    if (!member) return unauthorized();

    return NextResponse.json(toPayload(member));
  } catch (error) {
    console.error('프리셋 조회 실패', error);
    return NextResponse.json(
      { error: '프리셋을 불러오지 못함' },
      { status: 500 },
    );
  }
};

export const PUT = async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '보낸 내용의 형식이 잘못됨' },
      { status: 400 },
    );
  }

  let member: MemberAccount | null;
  try {
    member = await readSessionMember(request);
  } catch (error) {
    console.error('프리셋 저장 전 세션 확인 실패', error);
    return NextResponse.json({ error: '프리셋을 저장하지 못함' }, { status: 500 });
  }
  if (!member) return unauthorized();

  const { preset: rawPreset } = (body ?? {}) as { preset?: unknown };

  // 검증 실패는 사용자가 고칠 수 있는 400, 저장 실패는 500이라 따로 잡는다.
  let preset;
  try {
    preset = parsePreset(rawPreset);
  } catch (error) {
    const message = error instanceof Error ? error.message : '프리셋 형식이 올바르지 않음';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const saved = await saveMemberPreset(member.id, preset);
    if (!saved) {
      return NextResponse.json({ error: '회원을 찾지 못함' }, { status: 404 });
    }
    return NextResponse.json(toPayload(saved));
  } catch (error) {
    console.error('프리셋 저장 실패', error);
    return NextResponse.json({ error: '프리셋을 저장하지 못함' }, { status: 500 });
  }
};
