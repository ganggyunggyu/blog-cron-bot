import assert from 'node:assert/strict';
import { buildDistributedJobClaimQuery } from './queue';
import { getDistributedJobMaxAttempts } from './run-store';

const now = new Date('2026-07-27T00:00:00.000Z');
const query = buildDistributedJobClaimQuery(
  'worker-a',
  now,
  'run-1',
  'job-1'
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
      ],
    },
    {
      status: 'running',
      leaseUntil: { $lte: now },
      workerId: { $ne: 'worker-a' },
    },
  ],
});
assert.equal(getDistributedJobMaxAttempts('pet'), 30);
assert.equal(getDistributedJobMaxAttempts('suripet'), 30);
assert.equal(getDistributedJobMaxAttempts('root'), 3);

process.stdout.write('distributed queue tests passed\n');
