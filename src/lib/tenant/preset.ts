import {
  CAFE_SOURCE_CONFIG,
  PAGE_CHECK_SOURCE_CONFIG,
  PRODUCT_SHEET_ID,
  ROOT_CONFIG,
  TEST_CONFIG,
} from '../../constants';
import {
  BLOG_IDS,
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
  SURI_PET_PAGE_CHECK_BLOG_IDS,
} from '../../constants/blog-ids';

/** 노출체크 종류. 대상마다 어떤 방식으로 도는지가 다르다. */
export const CHECK_KINDS = ['basic', 'more', 'page'] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export const CHECK_KIND_LABELS: Record<CheckKind, string> = {
  basic: '기본 노출체크',
  more: '더보기 노출체크',
  page: '페이지 노출체크',
};

/**
 * 이름 붙인 계정 묶음.
 *
 * 준최, 최블, 도그마루처럼 한 번 만들어두고 여러 대상이 골라 쓴다. 같은 계정 목록을
 * 대상마다 복사해 두면 계정 하나 추가할 때 빠뜨리는 곳이 생긴다.
 */
export interface BlogGroup {
  id: string;
  label: string;
  blogIds: string[];
}

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
  /** 이 대상에서 쓸 계정 그룹. 여러 개를 고르면 합집합으로 본다. */
  blogGroupIds?: string[];
  /** 그룹에 없는 계정을 이 대상에만 덧붙일 때 쓴다. */
  blogIds?: string[];
  enabled: boolean;
}

export interface TenantPreset {
  targets: PresetTarget[];
  /** 대상들이 골라 쓰는 계정 그룹. */
  blogGroups: BlogGroup[];
  /** 결과 알림을 보낼 Dooray 웹훅. 비어 있으면 환경변수 기본값을 쓴다. */
  doorayWebhookUrl?: string;
}

/**
 * 대상이 실제로 확인할 계정 목록.
 *
 * 고른 그룹을 순서대로 합치고 직접 계정을 뒤에 붙인다. 빈 배열이면 전체 계정을 뜻한다.
 */
export const resolveTargetBlogIds = (
  preset: TenantPreset,
  target: PresetTarget
): string[] => {
  const byId = new Map(preset.blogGroups.map((group) => [group.id, group]));
  const fromGroups = (target.blogGroupIds ?? []).flatMap(
    (groupId) => byId.get(groupId)?.blogIds ?? []
  );

  return Array.from(new Set([...fromGroups, ...(target.blogIds ?? [])]));
};

/**
 * 21lab 계정 그룹. 지금 코드 상수에 박혀 있는 목록을 그대로 옮긴 것이다.
 *
 * 더보기 추가 계정은 PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS에서 일반 계정을 뺀 나머지로
 * 계산한다. 같은 값을 두 곳에 적어두면 한쪽만 고쳐지는 일이 생긴다.
 */
const MORE_EXTRA_BLOG_IDS = PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS.filter(
  (blogId) => !BLOG_IDS.includes(blogId)
);

export const LAB_21_BLOG_GROUPS: BlogGroup[] = [
  { id: 'general', label: '일반 계정', blogIds: [...BLOG_IDS] },
  {
    id: 'dogmaru',
    label: '도그마루',
    blogIds: [...DOGMARU_PAGE_CHECK_BLOG_IDS],
  },
  {
    id: 'suripet',
    label: '서리펫',
    blogIds: [...SURI_PET_PAGE_CHECK_BLOG_IDS],
  },
  { id: 'more-extra', label: '더보기 추가 계정', blogIds: MORE_EXTRA_BLOG_IDS },
];

/**
 * 지금까지 코드 상수로 박혀 있던 21lab 운영 설정을 그대로 옮긴 기본 프리셋.
 *
 * 새 회원은 이 값을 복사해서 시작하는 게 아니라 빈 프리셋에서 시작한다.
 * 이 값은 21lab 계정에만 시드로 넣는다.
 */
export const LAB_21_PRESET: TenantPreset = {
  blogGroups: LAB_21_BLOG_GROUPS,
  targets: [
    {
      id: 'package',
      label: '패키지',
      kind: 'basic',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '패키지' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: TEST_CONFIG.SHEET_NAMES.PACKAGE },
      blogGroupIds: ['general'],
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
      blogGroupIds: ['general'],
      enabled: true,
    },
    {
      id: 'dogmaru',
      label: '도그마루',
      kind: 'basic',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: TEST_CONFIG.SHEET_NAMES.DOGMARU },
      blogGroupIds: ['dogmaru'],
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
      blogGroupIds: ['general'],
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
      maxPages: 1,
      blogGroupIds: ['general', 'dogmaru', 'suripet'],
      enabled: true,
    },
    {
      id: 'suripet',
      label: '서리펫',
      kind: 'page',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '서리펫' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: TEST_CONFIG.SHEET_NAMES.SERIPET },
      maxPages: 1,
      blogGroupIds: ['suripet'],
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
      blogGroupIds: ['general', 'more-extra'],
      enabled: true,
    },
    {
      id: 'general-more',
      label: '일반건 더보기',
      kind: 'more',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루 제외' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: '일반건_더보기' },
      blogGroupIds: ['general', 'more-extra'],
      enabled: true,
    },
    {
      id: 'dogmaru-more',
      label: '도그마루 더보기',
      kind: 'more',
      source: { sheetId: PRODUCT_SHEET_ID, tabTitle: '도그마루' },
      result: { sheetId: TEST_CONFIG.SHEET_ID, tabTitle: '도그마루_더보기' },
      blogGroupIds: ['dogmaru'],
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

export const EMPTY_PRESET: TenantPreset = { targets: [], blogGroups: [] };
