import assert from 'node:assert/strict';
import {
  DEFAULT_EXPOSURE_TARGETS,
  buildTargetEnvironment,
  planExposureTargetJobs,
  parseExposureSuiteOptions,
  resolveTargetCommand,
} from './options';

const defaults = parseExposureSuiteOptions([], {});
assert.deepEqual(defaults.targets, DEFAULT_EXPOSURE_TARGETS);
assert.equal(defaults.concurrency, 8);
assert.equal(defaults.maxPages, 4);
assert.equal(defaults.targetConcurrency, 2);

const configured = parseExposureSuiteOptions(
  [
    '--targets=pet,package,cafe',
    '--concurrency=8',
    '--max-pages=9',
    '--target-concurrency=3',
  ],
  {}
);
assert.deepEqual(configured.targets, ['pet', 'package', 'cafe']);
assert.equal(configured.concurrency, 8);
assert.equal(configured.maxPages, 9);
assert.equal(configured.targetConcurrency, 3);

assert.throws(
  () => parseExposureSuiteOptions(['--targets=package,unknown'], {}),
  /허용되지 않은 노출체크 대상/
);
assert.throws(
  () => parseExposureSuiteOptions(['--concurrency=9'], {}),
  /1~8/
);
assert.throws(
  () => parseExposureSuiteOptions(['--max-pages=0'], {}),
  /1~9/
);

assert.deepEqual(resolveTargetCommand('package'), {
  script: 'cron:sheet',
  args: ['package'],
});
assert.deepEqual(resolveTargetCommand('general'), {
  script: 'cron:exclude',
  args: [],
});
assert.deepEqual(resolveTargetCommand('dogmaru'), {
  script: 'cron:dogmaru',
  args: [],
});
assert.deepEqual(resolveTargetCommand('root'), {
  script: 'cron:root',
  args: [],
});
assert.deepEqual(resolveTargetCommand('pet'), {
  script: 'cron:pages',
  args: ['pet'],
});
assert.deepEqual(resolveTargetCommand('cafe'), {
  script: 'cafe:schedule:run',
  args: [],
});

assert.deepEqual(
  planExposureTargetJobs(['cafe', 'pet', 'suripet', 'root']),
  [
    {
      targets: ['cafe'],
      command: { script: 'cafe:schedule:run', args: [] },
    },
    {
      targets: ['pet', 'suripet'],
      command: { script: 'cron:pages', args: ['pet,suripet'] },
    },
    {
      targets: ['root'],
      command: { script: 'cron:root', args: [] },
    },
  ]
);
assert.deepEqual(
  planExposureTargetJobs(['cafe', 'pet', 'dogmaru', 'suripet', 'root']),
  [
    {
      targets: ['cafe'],
      command: { script: 'cafe:schedule:run', args: [] },
    },
    {
      targets: ['dogmaru', 'pet', 'suripet'],
      command: {
        script: 'cron:pages',
        args: ['dogmaru,pet,suripet'],
      },
    },
    {
      targets: ['root'],
      command: { script: 'cron:root', args: [] },
    },
  ]
);
assert.deepEqual(planExposureTargetJobs(['dogmaru', 'pet']), [
  {
    targets: ['dogmaru'],
    command: { script: 'cron:dogmaru', args: [] },
  },
  {
    targets: ['pet'],
    command: { script: 'cron:pages', args: ['pet'] },
  },
]);
assert.deepEqual(planExposureTargetJobs(['suripet']), [
  {
    targets: ['suripet'],
    command: { script: 'cron:pages', args: ['suripet'] },
  },
]);

const inheritedEnvironment = {
  KEEP_ME: 'yes',
  ONLY_SHEET_TYPE: 'should-not-leak',
  EXPOSURE_MAX_PAGES: '9',
  PAGE_CHECK_MAX_PAGES: '9',
};
const rootEnvironment = buildTargetEnvironment(
  inheritedEnvironment,
  ['root'],
  8,
  4
);
assert.equal(rootEnvironment.KEEP_ME, 'yes');
assert.equal(rootEnvironment.EXPOSURE_MAX_PAGES, undefined);
assert.equal(rootEnvironment.PAGE_CHECK_MAX_PAGES, undefined);
assert.equal(rootEnvironment.ONLY_SHEET_TYPE, undefined);

for (const target of ['general', 'dogmaru', 'root', 'cafe'] as const) {
  const environment = buildTargetEnvironment(
    inheritedEnvironment,
    [target],
    8,
    4
  );
  assert.equal(environment.EXPOSURE_MAX_PAGES, undefined);
  assert.equal(environment.PAGE_CHECK_MAX_PAGES, undefined);
}

const packageEnvironment = buildTargetEnvironment(
  inheritedEnvironment,
  ['package'],
  8,
  4
);
assert.equal(packageEnvironment.ONLY_SHEET_TYPE, undefined);
assert.equal(packageEnvironment.EXPOSURE_MAX_PAGES, undefined);
assert.equal(packageEnvironment.PAGE_CHECK_MAX_PAGES, undefined);

const petEnvironment = buildTargetEnvironment(
  inheritedEnvironment,
  ['pet', 'suripet'],
  8,
  4
);
assert.equal(petEnvironment.EXPOSURE_MAX_PAGES, '4');
assert.equal(petEnvironment.PAGE_CHECK_MAX_PAGES, '4');
assert.equal(petEnvironment.EXPOSURE_CONCURRENCY, '8');
assert.equal(petEnvironment.EXPOSURE_KEYWORD_BATCH_SIZE, '50');
assert.equal(petEnvironment.FAST_EXPOSURE_MODE, 'true');

process.stdout.write('exposure suite option tests passed\n');
