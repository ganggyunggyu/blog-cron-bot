export const SHEET_APP_URL =
  process.env.SHEET_APP_URL || 'http://localhost:3000';

export const PRODUCT_SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';

export const SHEET_TYPE = {
  PACKAGE: 'package',
  DOGMARU_EXCLUDE: 'dogmaru-exclude',
  DOGMARU: 'dogmaru',
} as const;

export type SheetType = (typeof SHEET_TYPE)[keyof typeof SHEET_TYPE];

export interface SyncRequest {
  sheetId: string;
  sheetName: string;
  sheetType: SheetType;
}

export interface ImportRequest extends SyncRequest {
  mode: 'rewrite' | 'append';
}

interface SheetConfig {
  sheetId: string;
  sheetName: string;
  sheetType: SheetType;
  label: string;
}

const SHEET_CONFIGS: SheetConfig[] = [
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '패키지',
    sheetType: SHEET_TYPE.PACKAGE,
    label: '패키지',
  },
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '도그마루 제외',
    sheetType: SHEET_TYPE.DOGMARU_EXCLUDE,
    label: '도그마루 제외',
  },
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '도그마루',
    sheetType: SHEET_TYPE.DOGMARU,
    label: '도그마루',
  },
];

export const TEST_CONFIG = {
  SHEET_ID: '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0',
  SHEET_NAMES: {
    PACKAGE: '패키지',
    DOGMARU_EXCLUDE: '일반건',
    DOGMARU: '도그마루',
    ROOT: '루트',
  },
  LABELS: {
    PACKAGE: '패키지',
    DOGMARU_EXCLUDE: '일반건',
    DOGMARU: '도그마루',
    ROOT: '루트',
  },
} as const;

export const ALIBABA_CONFIG = {
  SHEET_ID: '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0',
  TAB_NAME: '알리바바',
  KEYWORD_COL: 1,
  RESULT_COLS: {
    EXPOSED: 2,
    RANK: 4,
    TOPIC: 5,
    LINK: 6,
  },
} as const;

export const ROOT_CONFIG = {
  SHEET_ID: '1CsO-R1LMrsQdUw7T1KEL2I4bMxAeYnZIklOgr8e_DPY',

  SHEET_NAMES: {
    PACKAGE: '월보장 시트',
  },
  LABELS: {
    PACKAGE: '월보장 시트',
  },
};

/**
 * 패키지/일반건/도그마루/루트 노출체크가 실제로 키워드를 읽고 써야 하는 진짜 운영 시트 위치.
 * 예전에 이 매핑이 run-parallel-direct-sheet-check.ts와 check-old-logic-more-exposure.ts에
 * 각각 따로 정의돼 있다가 스크래치 시트(TEST_CONFIG.SHEET_ID)를 기본값으로 잘못 가리키는
 * 버그가 있었음 — 단일 소스로 통합해서 재발을 막음.
 */
export const EXPOSURE_SHEET_LOCATIONS = {
  패키지: { sheetId: PRODUCT_SHEET_ID, tabTitle: '패키지' },
  일반건: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루 제외' },
  도그마루: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루' },
  루트: { sheetId: ROOT_CONFIG.SHEET_ID, tabTitle: ROOT_CONFIG.SHEET_NAMES.PACKAGE },
} as const;

export type ExposureSheetLocationKey = keyof typeof EXPOSURE_SHEET_LOCATIONS;

export const requests: SyncRequest[] = SHEET_CONFIGS.map(
  ({ sheetId, sheetName, sheetType }) => ({
    sheetId,
    sheetName,
    sheetType,
  })
);

export const importRes: ImportRequest[] = [
  {
    sheetId: TEST_CONFIG.SHEET_ID,
    sheetName: TEST_CONFIG.SHEET_NAMES.PACKAGE,
    sheetType: SHEET_TYPE.PACKAGE,
    mode: 'rewrite',
  },
  {
    sheetId: TEST_CONFIG.SHEET_ID,
    sheetName: TEST_CONFIG.SHEET_NAMES.DOGMARU_EXCLUDE,
    sheetType: SHEET_TYPE.DOGMARU_EXCLUDE,
    mode: 'rewrite',
  },
  {
    sheetId: TEST_CONFIG.SHEET_ID,
    sheetName: TEST_CONFIG.SHEET_NAMES.DOGMARU,
    sheetType: SHEET_TYPE.DOGMARU,
    mode: 'rewrite',
  },
];
