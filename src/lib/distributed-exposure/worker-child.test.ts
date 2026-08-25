import assert from 'node:assert/strict';
import { ALL_KEYWORDS_CONCURRENCY } from '../exposure-suite/options';
import {
  resolveDistributedWorkerConcurrency,
  resolveWorkerCommand,
} from './worker-child';
import type { IDistributedExposureJob } from './models';

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

const buildJob = (
  overrides: Partial<IDistributedExposureJob>
): IDistributedExposureJob =>
  ({
    runId: 'run-1',
    target: 'root-cafe-url',
    jobKind: 'root-cafe-url',
    concurrency: 0,
    maxPages: 1,
    shardIndex: 0,
    shardCount: 10,
    keywordIds: ['a', 'b'],
    cafeUrl: 'https://cafe.naver.com/localtable702/12345',
    ...overrides,
  }) as IDistributedExposureJob;

// 이 테스트가 이 파일에서 가장 중요하다. 카페 URL 잡이 분기를 못 만나고 아래로
// 흘러가면 resolveTargetCommand가 cron:root를 돌려 진짜 루트 결과를 덮어쓴다.
{
  const command = resolveWorkerCommand(buildJob({}));
  assert.equal(command.script, 'exposure:root:cafe-url');
  assert.notEqual(command.script, 'cron:root');
  assert.deepEqual(command.args, [
    '--url=https://cafe.naver.com/localtable702/12345',
  ]);
}

// 잡 문서가 어긋나면 조용히 다른 걸 돌리는 대신 멈춘다.
assert.throws(
  () => resolveWorkerCommand(buildJob({ target: 'root' })),
  /카페 URL 분산 대상이 아님/
);
assert.throws(
  () => resolveWorkerCommand(buildJob({ cafeUrl: undefined })),
  /카페 URL이 잡 문서에 제대로 실리지 않음/
);
assert.throws(
  () =>
    resolveWorkerCommand(
      buildJob({ cafeUrl: 'https://cafe.naver.com/f-e/cafes/1/articles/2' })
    ),
  /카페 URL이 잡 문서에 제대로 실리지 않음/
);

// 기존 대상은 그대로여야 한다.
assert.equal(
  resolveWorkerCommand(
    buildJob({ target: 'cafe', jobKind: 'standard', keywordIds: [] })
  ).script,
  'exposure:cafe-current'
);

process.stdout.write('distributed worker child tests passed\n');
