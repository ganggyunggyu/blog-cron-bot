import assert from 'node:assert/strict';
import { PAGE_JOB_SHARD_SIZE, buildPageTargetJobs } from './job-planner';

// 서로 다른 검색어 300개 → 50개씩 6조각. 여러 워커가 조각을 나눠 집어가 병렬로 도는지가
// 핵심이라, 조각 수가 1개로 뭉개지면 안 된다(예전 버그: 시트당 job 1개로만 만들어져서
// 워커가 여러 대 떠 있어도 실제로는 1대만 일했음).
const uniqueKeywords = Array.from({ length: 300 }, (_, index) => ({
  _id: `pet-${index}`,
  keyword: `키워드 ${index}`,
}));
const shardedJobs = buildPageTargetJobs('pet', uniqueKeywords);

assert.equal(shardedJobs.length, Math.ceil(300 / PAGE_JOB_SHARD_SIZE));
shardedJobs.forEach((job, index) => {
  assert.equal(job.target, 'pet');
  assert.equal(job.shardIndex, index);
  assert.equal(job.shardCount, shardedJobs.length);
});
assert.equal(
  new Set(shardedJobs.flatMap((job) => job.keywordIds ?? [])).size,
  300
);

// 키워드가 조각 크기보다 적으면 조각 1개만 만든다.
const smallJobs = buildPageTargetJobs('suripet', [
  { _id: 'a', keyword: '하나' },
  { _id: 'b', keyword: '둘' },
]);
assert.equal(smallJobs.length, 1);
assert.deepEqual(smallJobs[0].keywordIds, ['a', 'b']);

process.stdout.write('distributed job planner tests passed\n');
