import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionToken,
  readSessionToken,
  verifySessionToken,
} from './auth';

test('회원 ID를 서명된 세션 토큰에 보관함', async () => {
  process.env.DASHBOARD_SESSION_SECRET = 'dashboard-auth-test-secret';

  const token = await createSessionToken('21lab');
  const payload = await readSessionToken(token);

  assert.equal(payload?.memberId, '21lab');
  assert.equal(await verifySessionToken(token), true);
});

test('변조되거나 예전 형식인 세션 토큰을 거부함', async () => {
  process.env.DASHBOARD_SESSION_SECRET = 'dashboard-auth-test-secret';

  const token = await createSessionToken('21lab');
  assert.equal(await verifySessionToken(`${token}tampered`), false);
  assert.equal(await verifySessionToken('1234.signature'), false);
});
