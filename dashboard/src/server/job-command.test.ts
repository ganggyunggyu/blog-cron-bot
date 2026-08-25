import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExposureSuiteArgs } from './exposure-suite-options';
import { InvalidJobInputError } from './job-errors';
import { buildJobSpawnArgs } from './job-command';
import { getJobDefinition } from './job-registry';

test('suite 기본 옵션을 고정된 CLI 인자로 변환함', () => {
  assert.deepEqual(buildExposureSuiteArgs(undefined), [
    '--targets=package,general,dogmaru,root,pet,suripet,cafe',
    `--concurrency=${process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true' ? 0 : 50}`,
    '--max-pages=1',
    `--target-concurrency=${process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true' ? 1 : 2}`,
  ]);
});

test('검증된 suite 옵션만 pnpm 인자로 전달함', () => {
  const suiteJob = getJobDefinition('exposure-suite');
  assert.ok(suiteJob);
  assert.deepEqual(
    buildJobSpawnArgs(suiteJob, {
      targets: ['package', 'cafe'],
      concurrency: 50,
      maxPages: 9,
      targetConcurrency: 3,
    }),
    [
      'run',
      process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true'
        ? 'exposure:distributed'
        : 'exposure:suite',
      '--targets=package,cafe',
      `--concurrency=${process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true' ? 0 : 50}`,
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
    { concurrency: 51 },
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
  const reexportJob = getJobDefinition('reexport-current-exposure');
  assert.ok(rootJob);
  assert.ok(reexportJob);
  assert.deepEqual(
    buildJobSpawnArgs(rootJob, undefined),
    process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true'
      ? ['run', 'exposure:distributed', '--targets=root']
      : ['run', 'cron:root'],
  );
  assert.deepEqual(buildJobSpawnArgs(reexportJob, undefined), [
    'run',
    'exposure:reexport:current',
  ]);
  assert.throws(
    () => buildJobSpawnArgs(rootJob, { env: { EXTRA_COMMAND: '1' } }),
    InvalidJobInputError,
  );
  assert.equal(getJobDefinition('parallel-check'), undefined);
  assert.equal(getJobDefinition('cafe-check'), undefined);
});

test('분산 실행에서는 개별 대상 잡도 분산 러너로 보냄', () => {
  // 개별 잡의 로컬 스크립트(cron:sheet, cron:pages 등)는 이 레포에 없는 외부 시트 API에
  // 의존해 원격에서 항상 실패했음 — 분산이 켜지면 전체 실행과 같은 러너를 쓰도록 고정함.
  const isDistributed = process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true';
  const cases: Array<[string, string, string[]]> = [
    ['package-exposure', 'exposure:package', ['--targets=package']],
    ['general-exposure', 'exposure:general', ['--targets=general']],
    ['dogmaru-exposure', 'exposure:dogmaru', ['--targets=dogmaru']],
    ['pet-exposure', 'exposure:pet', ['--targets=pet', '--max-pages=1']],
    [
      'pet-exposure-9-direct',
      'exposure:pet:9-direct',
      ['--targets=pet', '--max-pages=9'],
    ],
    ['suripet-exposure', 'exposure:suripet', ['--targets=suripet', '--max-pages=1']],
    ['cafe-exposure', 'exposure:cafe', ['--targets=cafe']],
  ];

  cases.forEach(([jobId, localScript, distributedArgs]) => {
    const job = getJobDefinition(jobId);
    assert.ok(job, `${jobId} 잡이 등록되어 있어야 함`);
    assert.deepEqual(
      buildJobSpawnArgs(job, undefined),
      isDistributed
        ? ['run', 'exposure:distributed', ...distributedArgs]
        : ['run', localScript],
    );
  });
});

test('suite 실행 방식과 target 계약을 명시적으로 제공함', () => {
  const suiteJob = getJobDefinition('exposure-suite');
  assert.ok(suiteJob);
  assert.equal(
    suiteJob.executionMode,
    process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true' ? 'distributed' : 'local',
  );
  assert.deepEqual(
    suiteJob.options?.targets.map(({ id, label }) => ({ id, label })),
    [
      { id: 'package', label: '패키지' },
      { id: 'general', label: '일반건' },
      { id: 'dogmaru', label: '도그마루' },
      { id: 'root', label: '루트' },
      { id: 'pet', label: '애견' },
      { id: 'suripet', label: '서리펫' },
      { id: 'cafe', label: '카페 + 블로그' },
    ],
  );
});
