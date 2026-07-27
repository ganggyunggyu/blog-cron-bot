import assert from 'node:assert/strict';
import {
  buildDistributedJobClaimQuery,
  buildDistributedJobReleaseFields,
} from './queue';
import { getDistributedJobMaxAttempts } from './run-store';

const now = new Date('2026-07-27T00:00:00.000Z');
const query = buildDistributedJobClaimQuery(
  'worker-a',
  now,
  'run-1',
  'job-1',
  '203.0.113.10'
);

assert.equal(query.runId, 'run-1');
assert.equal(query._id, 'job-1');
assert.deepEqual(query.$and[1], {
  $or: [
    {
      status: 'pending',
      $or: [
        { workerId: { $exists: false } },
        { workerId: 'worker-a' },
        { egressIp: '203.0.113.10' },
      ],
    },
    {
      status: 'running',
      leaseUntil: { $lte: now },
      egressIp: '203.0.113.10',
    },
  ],
});
assert.equal(getDistributedJobMaxAttempts('pet'), 60);
assert.equal(getDistributedJobMaxAttempts('suripet'), 60);
assert.equal(getDistributedJobMaxAttempts('root'), 3);
assert.deepEqual(buildDistributedJobReleaseFields(true, ['keyword-1']), {
  leaseUntil: 1,
  workerId: 1,
  egressIp: 1,
});
assert.deepEqual(buildDistributedJobReleaseFields(true), {
  leaseUntil: 1,
});
assert.deepEqual(buildDistributedJobReleaseFields(false, ['keyword-1']), {
  leaseUntil: 1,
  workerId: 1,
});

process.stdout.write('distributed queue tests passed\n');
