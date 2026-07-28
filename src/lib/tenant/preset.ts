import {
  CAFE_SOURCE_CONFIG,
  PAGE_CHECK_SOURCE_CONFIG,
  PRODUCT_SHEET_ID,
  ROOT_CONFIG,
  TEST_CONFIG,
} from '../../constants';
import { BLOG_ID_SEEDS } from '../../constants/blog-ids';

/** 노출체크 종류. 대상마다 어떤 방식으로 도는지가 다르다. */
export const CHECK_KINDS = ['basic', 'more', 'page'] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export const CHECK_KIND_LABELS: Record<CheckKind, string> = {
  basic: '기본 노출체크',
  more: '더보기 노출체크',
  page: '페이지 노출체크',
};

/** 프리셋 하나가 다루는 노출체크 대상. */
export interface PresetTarget {
  /** 실행 시 쓰는 대상 키. exposure-suite의 target id와 같아야 한다. */
  id: string;
  label: string;
  /** 어떤 종류의 노출체크인지. */
  kind: CheckKind;
  /** 키워드를 읽어올 원본 시트. */
  source: { sheetId: string; tabTitle: string };
  /** 결과를 쓸 시트. 비어 있으면 원본 시트에 그대로 반영한다. */
  result?: { sheetId: string; tabTitle: string };
  /** 페이지 노출체크에서 몇 페이지까지 볼지. */
  maxPages?: number;
  /** 이 대상에서 확인할 블로그 계정 목록. 비어 있으면 전체 계정을 본다. */
  blogIds?: string[];
  enabled: boolean;
}

export interface TenantPreset {
  targets: PresetTarget[];
  /** 결과 알림을 보낼 Dooray 웹훅. 비어 있으면 환경변수 기본값을 쓴다. */
  doorayWebhookUrl?: string;
}

/**
 * 지금까지 코드 상수로 박혀 있던 21lab 운영 설정을 그대로 옮긴 기본 프리셋.
 *
 * 새 회원은 이 값을 복사해서 시작하는 게 아니라 빈 프리셋에서 시작한다.
 * 이 값은 21lab 계정에만 시드로 넣는다.
 */
export const LAB_21_PRESET: TenantPreset = {
  targets: [
    {
      id: 'package',
      label: '패키지',
      kind: 'basic',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '패키지' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: TEST_CONFIG.SHEET_NAMES.PACKAGE },
      enabled: true,
    },
    {
      id: 'general',
      label: '일반건',
      kind: 'basic',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루 제외' },
      result: {
        sheetId: TEST_CONFIG.SHEET_ID,
        tabTitle: TEST_CONFIG.SHEET_NAMES.DOGMARU_EXCLUDE,
      },
      enabled: true,
    },
    {
      id: 'dogmaru',
      label: '도그마루',
      kind: 'basic',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: TEST_CONFIG.SHEET_NAMES.DOGMARU },
      blogIds: [...BLOG_ID_SEEDS.dogmaru],
      enabled: true,
    },
    {
      id: 'root',
      label: '루트',
      kind: 'basic',
      source: {
        sheetId: ROOT_CONFIG.SHEET_ID,
        tabTitle: ROOT_CONFIG.SHEET_NAMES.PACKAGE,
      },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: TEST_CONFIG.SHEET_NAMES.ROOT },
      enabled: true,
    },
    {
      id: 'pet',
      label: '애견',
      kind: 'page',
      source: {
        sheetId: PAGE_CHECK_SOURCE_CONFIG.SHEET_ID,
        tabTitle: PAGE_CHECK_SOURCE_CONFIG.SHEET_NAMES.PET,
      },
      maxPages: 4,
      enabled: true,
    },
    {
      id: 'suripet',
      label: '서리펫',
      kind: 'page',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '서리펫' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: TEST_CONFIG.SHEET_NAMES.SERIPET },
      maxPages: 4,
      blogIds: [...BLOG_ID_SEEDS.suripet],
      enabled: true,
    },
    {
      id: 'cafe',
      label: '카페 + 블로그',
      kind: 'basic',
      source: {
        sheetId: CAFE_SOURCE_CONFIG.SHEET_ID,
        tabTitle: CAFE_SOURCE_CONFIG.SHEET_NAME,
      },
      enabled: true,
    },
    {
      id: 'package-more',
      label: '패키지 더보기',
      kind: 'more',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '패키지' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: '패키지_더보기' },
      enabled: true,
    },
    {
      id: 'general-more',
      label: '일반건 더보기',
      kind: 'more',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루 제외' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: '일반건_더보기' },
      enabled: true,
    },
    {
      id: 'dogmaru-more',
      label: '도그마루 더보기',
      kind: 'more',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: '도그마루_더보기' },
      enabled: true,
    },
    {
      id: 'root-more',
      label: '루트 더보기',
      kind: 'more',
      source: {
        sheetId: ROOT_CONFIG.SHEET_ID,
        tabTitle: ROOT_CONFIG.SHEET_NAMES.PACKAGE,
      },
      enabled: true,
    },
  ],
};

export const EMPTY_PRESET: TenantPreset = { targets: [] };
