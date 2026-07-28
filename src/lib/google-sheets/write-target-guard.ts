import {
  PAGE_CHECK_SOURCE_CONFIG,
  PRODUCT_SHEET_ID,
  ROOT_CONFIG,
  TEST_CONFIG,
} from '../../constants';

const READ_ONLY_SOURCE_SHEET_IDS = new Set([
  PRODUCT_SHEET_ID,
  ROOT_CONFIG.SHEET_ID,
  PAGE_CHECK_SOURCE_CONFIG.SHEET_ID,
]);

export const isReadOnlySourceSheet = (sheetId: string): boolean =>
  READ_ONLY_SOURCE_SHEET_IDS.has(sheetId.trim());

export const assertWritableSheetId = (
  sheetId: string,
  operation: string
): void => {
  if (sheetId.trim() !== TEST_CONFIG.SHEET_ID) {
    throw new Error(
      `${operation}: 프로그램 노출체크 외 시트(${sheetId})에는 쓸 수 없음`
    );
  }
};
