import assert from 'node:assert/strict';
import { describeUnfinishedJobs } from './run-monitor';
import type { DistributedRunSnapshot } from './queue';

const snapshot: DistributedRunSnapshot = {
  total: 3,
  pending: 1,
  running: 0,
  success: 1,
  failed: 1,
  jobs: [
    {
      target: 'package',
      status: 'success',
      shardIndex: 0,
      shardCount: 1,
      attempts: 1,
      maxAttempts: 3,
      remainingKeywords: 0,
    },
    {
      target: 'pet',
      status: 'failed',
      shardIndex: 0,
      shardCount: 1,
      attempts: 32,
      maxAttempts: 60,
      remainingKeywords: 99,
      error: 'pet 종료 코드 unknown\n  navigating to  "https://search.naver.com"',
    },
    {
      target: 'root',
      status: 'pending',
      shardIndex: 0,
      shardCount: 1,
      attempts: 1,
      maxAttempts: 3,
      remainingKeywords: 190,
    },
  ],
};

const description = describeUnfinishedJobs(snapshot);

// 성공한 대상은 빼고, 막힌 대상만 원인과 함께 남겨야 함.
assert.ok(!description.includes('package'));
assert.ok(description.includes('pet(failed, 시도 32/60, 남은 키워드 99개)'));
assert.ok(description.includes('root(pending, 시도 1/3, 남은 키워드 190개)'));

// 여러 줄 오류는 한 줄로 눌러서 로그 한 줄에 들어가야 함.
assert.ok(!description.includes('\n'));
assert.ok(description.includes('navigating to "https://search.naver.com"'));

// 오류 기록이 없으면 그 사실을 명시해야 원인 추적이 끊기지 않음.
assert.ok(description.includes('기록된 오류 없음'));

process.stdout.write('distributed run monitor tests passed\n');
