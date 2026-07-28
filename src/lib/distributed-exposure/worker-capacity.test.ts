import assert from 'node:assert/strict';
import { getWorkerJobConcurrency } from './worker-capacity';

assert.equal(getWorkerJobConcurrency(undefined), 1);
assert.equal(getWorkerJobConcurrency('invalid'), 1);
assert.equal(getWorkerJobConcurrency('0'), 1);
assert.equal(getWorkerJobConcurrency('2'), 2);
assert.equal(getWorkerJobConcurrency('3'), 3);
assert.equal(getWorkerJobConcurrency('8'), 3);

process.stdout.write('distributed worker capacity tests passed\n');
