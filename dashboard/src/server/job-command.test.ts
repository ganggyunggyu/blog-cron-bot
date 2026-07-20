import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExposureSuiteArgs } from './exposure-suite-options';
import { InvalidJobInputError } from './job-errors';
import { buildJobSpawnArgs } from './job-command';
import { getJobDefinition } from './job-registry';

test('suite 기본 옵션을 고정된 CLI 인자로 변환함', () => {
  assert.deepEqual(buildExposureSuiteArgs(undefined), [
    '--targets=package,general,dogmaru,root,pet,suripet,cafe',
    '--concurrency=8',
    '--max-pages=4',
    '--target-concurrency=2',
  ]);
});

test('검증된 suite 옵션만 pnpm 인자로 전달함', () => {
  const suiteJob = getJobDefinition('exposure-suite');
  assert.ok(suiteJob);
  assert.deepEqual(
    buildJobSpawnArgs(suiteJob, {
      targets: ['package', 'cafe'],
      concurrency: 8,
      maxPages: 9,
      targetConcurrency: 3,
    }),
    [
      'run',
      'exposure:suite',
      '--targets=package,cafe',
      '--concurrency=8',
      '--max-pages=9',
      '--target-concurrency=3',
    ],
  );
});

test('허용되지 않은 suite 입력을 거부함', () => {
  const invalidInputs: unknown[] = [
    { targets: [] },
    { targets: ['package', 'package'] },
    { targets: ['unknown'] },
    { concurrency: 9 },
    { maxPages: 0 },
    { targetConcurrency: 4 },
    { command: 'arbitrary-command' },
  ];

  invalidInputs.forEach((input) => {
    assert.throws(() => buildExposureSuiteArgs(input), InvalidJobInputError);
  });
});

test('표준 잡은 임의 옵션을 받지 않고 unsafe 잡은 등록하지 않음', () => {
  const rootJob = getJobDefinition('root-exposure');
  assert.ok(rootJob);
  assert.deepEqual(buildJobSpawnArgs(rootJob, undefined), ['run', 'cron:root']);
  assert.throws(
    () => buildJobSpawnArgs(rootJob, { env: { EXTRA_COMMAND: '1' } }),
    InvalidJobInputError,
  );
  assert.equal(getJobDefinition('parallel-check'), undefined);
  assert.equal(getJobDefinition('cafe-check'), undefined);
});
