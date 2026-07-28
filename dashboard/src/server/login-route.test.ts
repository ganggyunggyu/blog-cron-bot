import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/login/route';

const createLoginRequest = (body: Record<string, string>) =>
  new NextRequest('http://localhost:4500/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('아이디 없는 공유 비밀번호 로그인을 거부함', async () => {
  const response = await POST(createLoginRequest({ password: 'legacy-password' }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: '아이디와 비밀번호를 입력해 주세요.',
  });
});

test('비밀번호 없는 회원 로그인을 거부함', async () => {
  const response = await POST(createLoginRequest({ loginId: '21lab' }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: '아이디와 비밀번호를 입력해 주세요.',
  });
});
