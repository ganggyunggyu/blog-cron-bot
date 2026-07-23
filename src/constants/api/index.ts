export const SHEET_APP_URL =
  process.env.SHEET_APP_URL || 'http://localhost:3000';

export const PRODUCT_SHEET_ID = '1aIKP9XnB20q8WWvwZzMNk2yM0waKZcQ1x6CtyM19HNw';

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
    SERIPET: '서리펫',
    ROOT: '루트',
  },
  LABELS: {
    PACKAGE: '패키지',
    DOGMARU_EXCLUDE: '일반건',
    DOGMARU: '도그마루',
    SERIPET: '서리펫',
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
  SHEET_ID: '1Cgn-CFMEobWpwhdmrJxVKgVLMblGQ_JEX4xVpXS4_ZA',
  SHEET_GID: 1928230154,

  SHEET_NAMES: {
    PACKAGE: '2l1ab 최적화 블로그 스케쥴',
  },
  LABELS: {
    PACKAGE: '2l1ab 최적화 블로그 스케쥴',
  },
};

export const CAFE_SOURCE_CONFIG = {
  SHEET_ID: PRODUCT_SHEET_ID,
  SHEET_GID: 250477480,
  SHEET_NAME: '카페 작업',
} as const;

export const PAGE_CHECK_SOURCE_CONFIG = {
  SHEET_ID: '1c9TJ1gETtunuCmzfzap-2lyqXj1cwzITOb1k8W4tL8c',
  SHEET_NAMES: {
    PET: '애견',
  },
} as const;

/**
 * 노출체크 키워드를 읽는 원본 위치. 모두 읽기 전용이며 결과는 TEST_CONFIG 등 별도
 * 결과 시트로만 내보낸다. 쓰기 경로에서는 write-target-guard를 반드시 통과해야 한다.
 */
export const EXPOSURE_SHEET_LOCATIONS = {
  패키지: { sheetId: PRODUCT_SHEET_ID, tabTitle: '패키지' },
  일반건: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루 제외' },
  도그마루: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루' },
  서리펫: { sheetId: PRODUCT_SHEET_ID, tabTitle: '서리펫' },
  애견: {
    sheetId: PAGE_CHECK_SOURCE_CONFIG.SHEET_ID,
    tabTitle: PAGE_CHECK_SOURCE_CONFIG.SHEET_NAMES.PET,
  },
  루트: { sheetId: ROOT_CONFIG.SHEET_ID, tabTitle: ROOT_CONFIG.SHEET_NAMES.PACKAGE },
  카페: { sheetId: CAFE_SOURCE_CONFIG.SHEET_ID, tabTitle: CAFE_SOURCE_CONFIG.SHEET_NAME },
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
