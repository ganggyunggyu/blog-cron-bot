import assert from 'node:assert/strict';
import { PRODUCT_SHEET_ID, ROOT_CONFIG, TEST_CONFIG } from '../../constants';
import { assertWritableSheetId, isReadOnlySourceSheet } from './write-target-guard';

assert.equal(isReadOnlySourceSheet(PRODUCT_SHEET_ID), true);
assert.equal(isReadOnlySourceSheet(ROOT_CONFIG.SHEET_ID), true);
assert.equal(isReadOnlySourceSheet(TEST_CONFIG.SHEET_ID), false);

assert.throws(
  () => assertWritableSheetId(PRODUCT_SHEET_ID, '병렬 노출체크'),
  /읽기 전용 원본 시트/
);
assert.throws(
  () => assertWritableSheetId(ROOT_CONFIG.SHEET_ID, '루트 노출체크'),
  /읽기 전용 원본 시트/
);
assert.doesNotThrow(() =>
  assertWritableSheetId(TEST_CONFIG.SHEET_ID, '결과 내보내기')
);

process.stdout.write('write target guard tests passed\n');
