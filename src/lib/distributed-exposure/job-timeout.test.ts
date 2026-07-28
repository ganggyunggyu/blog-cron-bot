import assert from 'node:assert/strict';
import { getDistributedJobTimeoutMs } from './job-timeout';

assert.equal(getDistributedJobTimeoutMs(undefined), 10 * 60_000);
assert.equal(getDistributedJobTimeoutMs(undefined, 'pet'), 15 * 60_000);
assert.equal(getDistributedJobTimeoutMs(undefined, 'suripet'), 15 * 60_000);
assert.equal(getDistributedJobTimeoutMs(undefined, 'root'), 15 * 60_000);
assert.equal(getDistributedJobTimeoutMs('7'), 7 * 60_000);
assert.equal(getDistributedJobTimeoutMs('7', 'suripet'), 7 * 60_000);
assert.equal(getDistributedJobTimeoutMs('0'), 10 * 60_000);
assert.equal(getDistributedJobTimeoutMs('0', 'pet'), 15 * 60_000);
assert.equal(getDistributedJobTimeoutMs('invalid'), 10 * 60_000);

console.log('distributed exposure job timeout tests passed');
