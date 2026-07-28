import assert from 'node:assert/strict';
import { parseEgressIpResponse } from './worker-egress-ip';

assert.equal(parseEgressIpResponse({ ip: '203.0.113.10' }), '203.0.113.10');
assert.equal(parseEgressIpResponse({ ip: '2001:db8::1' }), '2001:db8::1');
assert.throws(() => parseEgressIpResponse({ ip: 'not-an-ip' }), /유효하지 않은/);
assert.throws(() => parseEgressIpResponse(null), /응답 형식/);

process.stdout.write('worker egress IP tests passed\n');
