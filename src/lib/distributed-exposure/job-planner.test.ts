import assert from 'node:assert/strict';
import {
  DEFAULT_REMOTE_WORKER_COUNT,
  PAGE_JOB_MAX_SHARD_SIZE,
  buildKeywordTargetJobs,
  buildPageTargetJobs,
  interleaveTargetJobs,
  resolveRemoteWorkerCount,
} from './job-planner';

// 조각 수는 상시 워커 수를 따라간다. 환경변수가 없으면 기본값을 쓴다.
assert.equal(resolveRemoteWorkerCount(undefined), DEFAULT_REMOTE_WORKER_COUNT);
assert.equal(resolveRemoteWorkerCount('15'), 15);
assert.equal(resolveRemoteWorkerCount('0'), DEFAULT_REMOTE_WORKER_COUNT);
assert.equal(resolveRemoteWorkerCount('-3'), DEFAULT_REMOTE_WORKER_COUNT);
assert.equal(resolveRemoteWorkerCount('2.5'), DEFAULT_REMOTE_WORKER_COUNT);
assert.equal(resolveRemoteWorkerCount(''), DEFAULT_REMOTE_WORKER_COUNT);

// 서로 다른 검색어 300개는 상시 워커 수만큼 조각으로 균등 분배한다.
const uniqueKeywords = Array.from({ length: 300 }, (_, index) => ({
  _id: `pet-${index}`,
  keyword: `키워드 ${index}`,
}));
const shardedJobs = buildPageTargetJobs('pet', uniqueKeywords);

assert.equal(shardedJobs.length, DEFAULT_REMOTE_WORKER_COUNT);
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
assert.equal(suripetJobs.length, DEFAULT_REMOTE_WORKER_COUNT);
assert.ok(
  Math.max(...suripetJobs.map((job) => job.keywordIds?.length ?? 0)) -
    Math.min(...suripetJobs.map((job) => job.keywordIds?.length ?? 0)) <=
    2
);

const interleaved = interleaveTargetJobs([
  ...buildKeywordTargetJobs('package', uniqueKeywords.slice(0, 2)),
  ...buildKeywordTargetJobs('general', uniqueKeywords.slice(2, 4)),
  ...buildKeywordTargetJobs('dogmaru', uniqueKeywords.slice(4, 6)),
]);
assert.deepEqual(
  interleaved.slice(0, 3).map(({ target }) => target),
  ['package', 'general', 'dogmaru']
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

const rootJobs = buildKeywordTargetJobs(
  'root',
  Array.from({ length: 191 }, (_, index) => ({
    _id: `root-${index}`,
    keyword: `루트 키워드 ${index}`,
  }))
);
assert.equal(rootJobs.length, DEFAULT_REMOTE_WORKER_COUNT);
assert.equal(new Set(rootJobs.flatMap((job) => job.keywordIds ?? [])).size, 191);
assert.ok(
  Math.max(...rootJobs.map((job) => job.keywordIds?.length ?? 0)) -
    Math.min(...rootJobs.map((job) => job.keywordIds?.length ?? 0)) <=
    1
);

const packageJobs = buildKeywordTargetJobs(
  'package',
  Array.from({ length: 91 }, (_, index) => ({
    _id: `package-${index}`,
    keyword: `패키지 키워드 ${index}`,
  }))
);
assert.equal(packageJobs.length, DEFAULT_REMOTE_WORKER_COUNT);
assert.equal(
  new Set(packageJobs.flatMap((job) => job.keywordIds ?? [])).size,
  91
);
assert.ok(
  Math.max(...packageJobs.map((job) => job.keywordIds?.length ?? 0)) -
    Math.min(...packageJobs.map((job) => job.keywordIds?.length ?? 0)) <=
    1
);

process.stdout.write('distributed job planner tests passed\n');
