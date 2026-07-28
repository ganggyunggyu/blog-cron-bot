import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
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

  if (!loginId || !password) {
    return NextResponse.json(
      { error: '아이디와 비밀번호를 입력해 주세요.' },
      { status: 400 },
    );
  }

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
};
