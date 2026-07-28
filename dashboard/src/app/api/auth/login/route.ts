import { NextResponse, type NextRequest } from 'next/server';
import {
  LEGACY_MEMBER_ID,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifyLegacyPassword,
} from '@/server/auth';
import { authenticateMemberAccount } from '@/server/member-auth';

const setSessionCookie = async (memberId: string) => {
  const response = NextResponse.json({ ok: true, memberId });
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(memberId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
};

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const loginId = typeof body?.loginId === 'string' ? body.loginId.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력해 주세요.' }, { status: 400 });
  }

  // 아이디를 넣었으면 회원 계정으로만 확인한다.
  // 공유 비밀번호로 남의 아이디를 통과시키면 안 된다.
  if (loginId) {
    try {
      const member = await authenticateMemberAccount(loginId, password);
      if (!member) {
        return NextResponse.json(
          { error: '아이디 또는 비밀번호가 맞지 않음' },
          { status: 401 },
        );
      }
      return setSessionCookie(member.id);
    } catch (error) {
      console.error('회원 로그인 처리 실패', error);
      return NextResponse.json(
        { error: '로그인 처리 중 오류가 생김' },
        { status: 500 },
      );
    }
  }

  if (verifyLegacyPassword(password)) {
    return setSessionCookie(LEGACY_MEMBER_ID);
  }

  return NextResponse.json(
    { error: '아이디 또는 비밀번호가 맞지 않음' },
    { status: 401 },
  );
};
