import assert from 'node:assert/strict';
import {
  PAGE_CHECK_SOURCE_CONFIG,
  PRODUCT_SHEET_ID,
  ROOT_CONFIG,
  TEST_CONFIG,
} from '../../constants';
import { assertWritableSheetId, isReadOnlySourceSheet } from './write-target-guard';
import { importKeywords } from '../../api';

assert.equal(isReadOnlySourceSheet(PRODUCT_SHEET_ID), true);
assert.equal(isReadOnlySourceSheet(ROOT_CONFIG.SHEET_ID), true);
assert.equal(isReadOnlySourceSheet(PAGE_CHECK_SOURCE_CONFIG.SHEET_ID), true);
assert.equal(isReadOnlySourceSheet(TEST_CONFIG.SHEET_ID), false);

assert.throws(
  () => assertWritableSheetId(PRODUCT_SHEET_ID, '병렬 노출체크'),
  /프로그램 노출체크 외 시트/
);
assert.throws(
  () => assertWritableSheetId(ROOT_CONFIG.SHEET_ID, '루트 노출체크'),
  /프로그램 노출체크 외 시트/
);
assert.throws(
  () => assertWritableSheetId(PAGE_CHECK_SOURCE_CONFIG.SHEET_ID, '애견 노출체크'),
  /프로그램 노출체크 외 시트/
);
assert.throws(
  () => assertWritableSheetId('unknown-sheet-id', '알 수 없는 쓰기'),
  /프로그램 노출체크 외 시트/
);
assert.doesNotThrow(() =>
  assertWritableSheetId(TEST_CONFIG.SHEET_ID, '결과 내보내기')
);

void assert.rejects(
  importKeywords({
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '패키지',
    sheetType: 'package',
    mode: 'rewrite',
  }),
  /프로그램 노출체크 외 시트/
).then(() => {
  process.stdout.write('write target guard tests passed\n');
});
