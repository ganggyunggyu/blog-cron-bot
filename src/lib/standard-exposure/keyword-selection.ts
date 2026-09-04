import type { IKeyword } from '../../database';

export interface StandardExposureSelection {
  keywords: IKeyword[];
  onlySheetType: string;
  isDistributedShard: boolean;
  startIndex: number;
  invalidKeywordRegex?: string;
}

const normalize = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');

const parseKeywordRegex = (value: string): RegExp | undefined => {
  if (!value) return undefined;
  try {
    return new RegExp(value);
  } catch {
    return undefined;
  }
};

export const selectStandardExposureKeywords = (
  allKeywords: IKeyword[],
  env: NodeJS.ProcessEnv
): StandardExposureSelection => {
  const onlySheetType = String(env.ONLY_SHEET_TYPE ?? '').trim();
  const onlyCompany = String(env.ONLY_COMPANY ?? '').trim();
  const regexValue = String(env.ONLY_KEYWORD_REGEX ?? '').trim();
  const onlyId = String(env.ONLY_ID ?? '').trim();
  const isDistributedShard = env.DISTRIBUTED_EXPOSURE_SHARD === 'true';
  const keywordRegex = parseKeywordRegex(regexValue);
  let keywords = [...allKeywords];

  if (onlySheetType) {
    keywords = keywords.filter(
      (keyword) => normalize(keyword.sheetType) === normalize(onlySheetType)
    );
  }
  if (onlyCompany) {
    keywords = keywords.filter(
      (keyword) => normalize(keyword.company) === normalize(onlyCompany)
    );
  }
  if (keywordRegex) keywords = keywords.filter((keyword) => keywordRegex.test(keyword.keyword));
  if (onlyId) keywords = keywords.filter((keyword) => String(keyword._id) === onlyId);

  if (isDistributedShard) {
    const ids = new Set(
      String(env.DISTRIBUTED_EXPOSURE_KEYWORD_IDS ?? '')
        .split(',')
        .filter(Boolean)
    );
    if (ids.size === 0) throw new Error('분산 키워드 조각 ids 누락');
    keywords = keywords.filter((keyword) => ids.has(String(keyword._id)));
    if (keywords.length !== ids.size) {
      throw new Error(`분산 키워드 스냅샷 불일치: ${keywords.length}/${ids.size}`);
    }
  }

  const startIndexValue = Number(env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexValue)
    ? Math.max(0, Math.min(startIndexValue, keywords.length))
    : 0;
  return {
    keywords: keywords.slice(startIndex),
    onlySheetType,
    isDistributedShard,
    startIndex,
    invalidKeywordRegex: regexValue && !keywordRegex ? regexValue : undefined,
  };
};
