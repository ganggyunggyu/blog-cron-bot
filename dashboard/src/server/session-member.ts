import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, readSessionToken } from './auth';
import { findMemberAccountById, type MemberAccount } from './member-auth';

/**
 * 쿠키의 세션에서 지금 로그인한 회원을 읽는다.
 *
 * proxy가 서명 검증까지 해주지만, 서명이 맞아도 그 사이 계정이 지워졌을 수 있어
 * 실제 문서를 다시 읽어 확인한다.
 */
export const readSessionMember = async (
  request: NextRequest,
): Promise<MemberAccount | null> => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await readSessionToken(token);
  if (!payload) return null;

  return findMemberAccountById(payload.memberId);
};
