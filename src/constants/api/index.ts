export const SHEET_APP_URL =
  process.env.SHEET_APP_URL || 'http://localhost:3000';

export const PRODUCT_SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';

export const TEST_CONFIG = {
  SHEET_ID: '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0',
  SHEET_NAMES: {
    PACKAGE: '패키지 테스트',
    DOGMARU_EXCLUDE: '일반건 테스트',
    DOGMARU: '도그마루 테스트',
  },
  LABELS: {
    PACKAGE: '패키지 테스트',
    DOGMARU_EXCLUDE: '일반건 테스트',
    DOGMARU: '도그마루 테스트',
  },
} as const;

export const requests = [
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '패키지',
    sheetType: 'package',
  },
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '도그마루 제외',
    sheetType: 'dogmaru-exclude',
  },
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '도그마루',
    sheetType: 'dogmaru',
  },
] as {
  sheetId: string;
  sheetName: string;
  sheetType: string;
}[];

export const importRes = [
  {
    sheetId: TEST_CONFIG.SHEET_ID,
    sheetName: TEST_CONFIG.SHEET_NAMES.PACKAGE,
    sheetType: 'package',
    mode: 'rewrite',
  },
  {
    sheetId: TEST_CONFIG.SHEET_ID,
    sheetName: TEST_CONFIG.SHEET_NAMES.DOGMARU_EXCLUDE,
    sheetType: 'dogmaru-exclude',
    mode: 'rewrite',
  },
  {
    sheetId: TEST_CONFIG.SHEET_ID,
    sheetName: TEST_CONFIG.SHEET_NAMES.DOGMARU,
    sheetType: 'dogmaru',
    mode: 'rewrite',
  },
];
