import assert from 'node:assert/strict';
import {
  DEFAULT_EXPOSURE_TARGETS,
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
assert.deepEqual(resolveTargetCommand('pet'), {
  script: 'cron:pages',
  args: ['pet'],
});
assert.deepEqual(resolveTargetCommand('cafe'), {
  script: 'cafe:schedule:run',
  args: [],
});

process.stdout.write('exposure suite option tests passed\n');
