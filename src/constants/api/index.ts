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

export const ROOT_CONFIG = {
  SHEET_ID: '1CsO-R1LMrsQdUw7T1KEL2I4bMxAeYnZIklOgr8e_DPY',

  SHEET_NAMES: {
    PACKAGE: '월보장 시트',
  },
  LABELS: {
    PACKAGE: '월보장 시트',
  },
};

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
