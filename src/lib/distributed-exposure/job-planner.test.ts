import assert from 'node:assert/strict';
import {
  PAGE_JOB_MAX_SHARD_SIZE,
  PAGE_REMOTE_WORKER_COUNT,
  buildPageTargetJobs,
} from './job-planner';

// 서로 다른 검색어 300개는 운영 중인 원격 워커 30대에 균등 분배한다.
const uniqueKeywords = Array.from({ length: 300 }, (_, index) => ({
  _id: `pet-${index}`,
  keyword: `키워드 ${index}`,
}));
const shardedJobs = buildPageTargetJobs('pet', uniqueKeywords);

assert.equal(shardedJobs.length, PAGE_REMOTE_WORKER_COUNT);
shardedJobs.forEach((job, index) => {
  assert.equal(job.target, 'pet');
  assert.equal(job.shardIndex, index);
  assert.equal(job.shardCount, shardedJobs.length);
  assert.ok((job.keywordIds?.length ?? 0) <= PAGE_JOB_MAX_SHARD_SIZE);
});
assert.equal(
  new Set(shardedJobs.flatMap((job) => job.keywordIds ?? [])).size,
  300
);

const suripetJobs = buildPageTargetJobs(
  'suripet',
  Array.from({ length: 131 }, (_, index) => ({
    _id: `suripet-${index}`,
    keyword: `서리펫 ${index}`,
  }))
);
assert.equal(suripetJobs.length, PAGE_REMOTE_WORKER_COUNT);
assert.ok(
  Math.max(...suripetJobs.map((job) => job.keywordIds?.length ?? 0)) -
    Math.min(...suripetJobs.map((job) => job.keywordIds?.length ?? 0)) <=
    2
);

// 키워드가 워커 수보다 적으면 키워드 수만큼만 조각을 만든다.
const smallJobs = buildPageTargetJobs('suripet', [
  { _id: 'a', keyword: '하나' },
  { _id: 'b', keyword: '둘' },
]);
assert.equal(smallJobs.length, 2);
assert.deepEqual(
  smallJobs.map((job) => job.keywordIds),
  [['a'], ['b']]
);

process.stdout.write('distributed job planner tests passed\n');
