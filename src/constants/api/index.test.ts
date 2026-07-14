import assert from 'node:assert/strict';
import {
  EXPOSURE_SHEET_LOCATIONS,
  PRODUCT_SHEET_ID,
  ROOT_CONFIG,
  TEST_CONFIG,
} from './index';

// 패키지/일반건/도그마루/노출체크는 반드시 "패키지현황"(진짜 운영 시트)을 봐야 함.
// 예전에 이 값이 TEST_CONFIG.SHEET_ID(스크래치용 "프로그램 노출체크" 시트)를 기본값으로
// 잘못 가리키던 버그가 있었고, 그로 인해 키워드 개수가 실제보다 적게 잡혔음 — 재발 방지용.
assert.equal(EXPOSURE_SHEET_LOCATIONS.패키지.sheetId, PRODUCT_SHEET_ID);
assert.equal(EXPOSURE_SHEET_LOCATIONS.일반건.sheetId, PRODUCT_SHEET_ID);
assert.equal(EXPOSURE_SHEET_LOCATIONS.도그마루.sheetId, PRODUCT_SHEET_ID);

assert.notEqual(EXPOSURE_SHEET_LOCATIONS.패키지.sheetId, TEST_CONFIG.SHEET_ID);
assert.notEqual(EXPOSURE_SHEET_LOCATIONS.일반건.sheetId, TEST_CONFIG.SHEET_ID);
assert.notEqual(EXPOSURE_SHEET_LOCATIONS.도그마루.sheetId, TEST_CONFIG.SHEET_ID);

// 실제 운영 시트의 탭 이름은 "일반건"이 아니라 "도그마루 제외"임 (스크래치 시트에서만 "일반건"으로 불림)
assert.equal(EXPOSURE_SHEET_LOCATIONS.일반건.tabTitle, '도그마루 제외');
assert.equal(EXPOSURE_SHEET_LOCATIONS.패키지.tabTitle, '패키지');
assert.equal(EXPOSURE_SHEET_LOCATIONS.도그마루.tabTitle, '도그마루');

// 루트는 별도 스프레드시트(ROOT_CONFIG)의 "월보장 시트" 탭을 봐야 함 (탭 이름이 "루트"가 아님)
assert.equal(EXPOSURE_SHEET_LOCATIONS.루트.sheetId, ROOT_CONFIG.SHEET_ID);
assert.equal(EXPOSURE_SHEET_LOCATIONS.루트.tabTitle, '월보장 시트');
assert.notEqual(EXPOSURE_SHEET_LOCATIONS.루트.sheetId, PRODUCT_SHEET_ID);

process.stdout.write('exposure sheet location tests passed\n');
