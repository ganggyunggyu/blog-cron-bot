import assert from 'node:assert/strict';
import { ALL_KEYWORDS_CONCURRENCY } from '../exposure-suite/options';
import { DEFAULT_EXPOSURE_CONCURRENCY } from '../exposure-run-config';
import { resolveDistributedWorkerConcurrency } from './worker-child';

assert.equal(
  resolveDistributedWorkerConcurrency('suripet', 0),
  DEFAULT_EXPOSURE_CONCURRENCY
);
assert.equal(
  resolveDistributedWorkerConcurrency('pet', 0),
  DEFAULT_EXPOSURE_CONCURRENCY
);
assert.equal(resolveDistributedWorkerConcurrency('suripet', 5), 5);
assert.equal(
  resolveDistributedWorkerConcurrency('root', 0),
  ALL_KEYWORDS_CONCURRENCY
);

process.stdout.write('distributed worker child tests passed\n');
