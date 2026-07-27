import assert from 'node:assert/strict';
import { buildPageTargetJobs } from './job-planner';

const keywordIds = Array.from({ length: 300 }, (_, index) => `pet-${index}`);
const jobs = buildPageTargetJobs('pet', keywordIds);

assert.equal(jobs.length, 1);
assert.equal(jobs[0].target, 'pet');
assert.equal(jobs[0].shardIndex, 0);
assert.equal(jobs[0].shardCount, 1);
assert.deepEqual(jobs[0].keywordIds, keywordIds);

process.stdout.write('distributed job planner tests passed\n');
