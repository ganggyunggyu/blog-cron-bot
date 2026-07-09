import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/server/auth';

export const POST = async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
};
