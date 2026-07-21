import { EXPOSURE_SHEET_LOCATIONS, TEST_CONFIG } from '../../constants';
import type { KeywordInfo } from '../csv-output';

export const ORDERED_RESULT_TARGETS = [
  'package',
  'general',
  'dogmaru',
  'root',
  'suripet',
] as const;

export type OrderedResultTarget = (typeof ORDERED_RESULT_TARGETS)[number];

export interface OrderedResultConfig {
  label: string;
  sourceSheetId: string;
  sourceTab: string;
  sourceSheetType: string;
  targetTab: string;
}

const TARGET_CONFIGS: Record<OrderedResultTarget, OrderedResultConfig> = {
  package: {
    label: '패키지',
    sourceSheetId: EXPOSURE_SHEET_LOCATIONS.패키지.sheetId,
    sourceTab: EXPOSURE_SHEET_LOCATIONS.패키지.tabTitle,
    sourceSheetType: 'package',
    targetTab: TEST_CONFIG.SHEET_NAMES.PACKAGE,
  },
  general: {
    label: '일반건',
    sourceSheetId: EXPOSURE_SHEET_LOCATIONS.일반건.sheetId,
    sourceTab: EXPOSURE_SHEET_LOCATIONS.일반건.tabTitle,
    sourceSheetType: 'dogmaru-exclude',
    targetTab: TEST_CONFIG.SHEET_NAMES.DOGMARU_EXCLUDE,
  },
  dogmaru: {
    label: '도그마루',
    sourceSheetId: EXPOSURE_SHEET_LOCATIONS.도그마루.sheetId,
    sourceTab: EXPOSURE_SHEET_LOCATIONS.도그마루.tabTitle,
    sourceSheetType: 'dogmaru',
    targetTab: TEST_CONFIG.SHEET_NAMES.DOGMARU,
  },
  root: {
    label: '루트',
    sourceSheetId: EXPOSURE_SHEET_LOCATIONS.루트.sheetId,
    sourceTab: EXPOSURE_SHEET_LOCATIONS.루트.tabTitle,
    sourceSheetType: 'root',
    targetTab: TEST_CONFIG.SHEET_NAMES.ROOT,
  },
  suripet: {
    label: '서리펫',
    sourceSheetId: EXPOSURE_SHEET_LOCATIONS.서리펫.sheetId,
    sourceTab: EXPOSURE_SHEET_LOCATIONS.서리펫.tabTitle,
    sourceSheetType: 'suripet',
    targetTab: TEST_CONFIG.SHEET_NAMES.SERIPET,
  },
};

export const getOrderedResultConfig = (
  target: OrderedResultTarget
): OrderedResultConfig => TARGET_CONFIGS[target];

const getKeywordKey = (
  target: OrderedResultTarget,
  keyword: KeywordInfo
): string => {
  if (target !== 'root') return keyword.keyword.trim();

  const company = keyword.company.trim();
  const suffix = `(${company})`;
  const normalizedKeyword = keyword.keyword.trim().endsWith(suffix)
    ? keyword.keyword.trim().slice(0, -suffix.length)
    : keyword.keyword.trim();
  return `${company}\u0000${normalizedKeyword}`;
};

export const selectIncludedKeywordsInSourceOrder = (
  target: OrderedResultTarget,
  sourceKeywords: KeywordInfo[],
  includedKeywords: KeywordInfo[]
): KeywordInfo[] => {
  const exactQueues = new Map<string, KeywordInfo[]>();
  const companyQueues = new Map<string, KeywordInfo[]>();
  const used = new Set<KeywordInfo>();

  includedKeywords.forEach((keyword) => {
    const key = getKeywordKey(target, keyword);
    const exactQueue = exactQueues.get(key) ?? [];
    exactQueue.push(keyword);
    exactQueues.set(key, exactQueue);

    if (target === 'root') {
      const companyQueue = companyQueues.get(keyword.company.trim()) ?? [];
      companyQueue.push(keyword);
      companyQueues.set(keyword.company.trim(), companyQueue);
    }
  });

  const shiftUnused = (queue?: KeywordInfo[]): KeywordInfo | undefined => {
    while (queue?.length) {
      const keyword = queue.shift();
      if (keyword && !used.has(keyword)) return keyword;
    }
    return undefined;
  };

  const ordered = sourceKeywords.flatMap((sourceKeyword) => {
    const keyword =
      shiftUnused(exactQueues.get(getKeywordKey(target, sourceKeyword))) ??
      (target === 'root'
        ? shiftUnused(companyQueues.get(sourceKeyword.company.trim()))
        : undefined);
    if (!keyword) return [];
    used.add(keyword);
    return [keyword];
  });

  if (used.size !== includedKeywords.length) {
    throw new Error(
      `${target} 원본 순서 매칭 실패: ${used.size}/${includedKeywords.length}`
    );
  }

  return ordered;
};
