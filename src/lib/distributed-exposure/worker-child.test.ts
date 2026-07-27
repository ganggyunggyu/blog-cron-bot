import assert from 'node:assert/strict';
import { ALL_KEYWORDS_CONCURRENCY } from '../exposure-suite/options';
import { resolveDistributedWorkerConcurrency } from './worker-child';

assert.equal(
  resolveDistributedWorkerConcurrency('suripet', 0, 131),
  131
);
assert.equal(
  resolveDistributedWorkerConcurrency('pet', 0, 300),
  300
);
assert.equal(resolveDistributedWorkerConcurrency('root', 0, 191), 191);
assert.equal(resolveDistributedWorkerConcurrency('suripet', 5), 5);
assert.equal(
  resolveDistributedWorkerConcurrency('package', 0),
  ALL_KEYWORDS_CONCURRENCY
);

process.stdout.write('distributed worker child tests passed\n');
