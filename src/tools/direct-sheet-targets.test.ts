import assert from 'node:assert/strict';
import {
  DIRECT_SHEET_TARGETS,
  parseDirectSheetTargets,
} from './direct-sheet-targets';

assert.deepEqual(DIRECT_SHEET_TARGETS, [
  'package',
  'dogmaru-exclude',
  'dogmaru',
  'seoripet',
  'pet',
]);
assert.deepEqual(parseDirectSheetTargets('package,general,suripet,pet'), [
  'package',
  'dogmaru-exclude',
  'seoripet',
  'pet',
]);
assert.deepEqual(parseDirectSheetTargets('애견'), ['pet']);
assert.throws(
  () => parseDirectSheetTargets('package,root'),
  /pnpm cron:root/
);
assert.throws(() => parseDirectSheetTargets('root'), /직접병렬 실행은 금지됨/);

process.stdout.write('direct sheet target tests passed\n');
