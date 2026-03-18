import { PopularItem, extractPopularItems } from '../../parser';
import { normalizeCafeName } from '../naver-source';

export interface CafeTarget {
  name: string;
  ids?: string[];
  aliases?: string[];
}

export interface CafeMatch {
  targetName: string;
  actualCafeName: string;
  sourceId: string;
  link: string;
  matchedBy: 'id' | 'name' | 'alias';
  cafeRank: number;
}

export interface CafeExposureRow {
  keyword: string;
  exposureStatus: '노출' | '미노출' | '확인실패';
  rank: string;
  cafeName: string;
  link: string;
}

const getUniqueStrings = (values: string[]): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter((value) => value.length > 0)
    )
  );

const isNameMatch = (actualName: string, targetName: string): boolean =>
  !!actualName &&
  !!targetName &&
  (actualName === targetName ||
    actualName.includes(targetName) ||
    targetName.includes(actualName));

const findTargetMatch = (
  item: PopularItem,
  targets: CafeTarget[],
  cafeRank: number
): CafeMatch | null => {
  if (item.sourceType !== 'cafe') {
    return null;
  }

  const itemSourceId = String(item.sourceId ?? '').toLowerCase();
  const itemCafeName = normalizeCafeName(item.blogName || '');

  for (const target of targets) {
    const targetIds = getUniqueStrings(target.ids || []).map((id) =>
      id.toLowerCase()
    );
    if (itemSourceId && targetIds.includes(itemSourceId)) {
      return {
        targetName: target.name,
        actualCafeName: item.blogName || target.name,
        sourceId: itemSourceId,
        link: item.link,
        matchedBy: 'id',
        cafeRank,
      };
    }

    const targetName = normalizeCafeName(target.name);
    if (isNameMatch(itemCafeName, targetName)) {
      return {
        targetName: target.name,
        actualCafeName: item.blogName || target.name,
        sourceId: itemSourceId,
        link: item.link,
        matchedBy: 'name',
        cafeRank,
      };
    }

    const aliases = getUniqueStrings(target.aliases || []).map((alias) =>
      normalizeCafeName(alias)
    );
    if (aliases.some((alias) => isNameMatch(itemCafeName, alias))) {
      return {
        targetName: target.name,
        actualCafeName: item.blogName || target.name,
        sourceId: itemSourceId,
        link: item.link,
        matchedBy: 'alias',
        cafeRank,
      };
    }
  }

  return null;
};

export const extractCafeItems = (html: string): PopularItem[] =>
  extractPopularItems(html, { includeCafe: true }).filter(
    (item) => item.sourceType === 'cafe'
  );

export const matchCafeTargets = (
  items: PopularItem[],
  targets: CafeTarget[]
): CafeMatch[] => {
  const matches: CafeMatch[] = [];
  const seenLinks = new Set<string>();

  items.forEach((item, index) => {
    const matchedTarget = findTargetMatch(item, targets, index + 1);
    if (!matchedTarget || seenLinks.has(matchedTarget.link)) {
      return;
    }

    seenLinks.add(matchedTarget.link);
    matches.push(matchedTarget);
  });

  return matches;
};

export const buildCafeExposureRow = (
  keyword: string,
  matches: CafeMatch[],
  errorMessage?: string
): CafeExposureRow => {
  if (errorMessage) {
    return {
      keyword,
      exposureStatus: '확인실패',
      rank: '',
      cafeName: errorMessage,
      link: '',
    };
  }

  const ranks = matches.map((match) => String(match.cafeRank));
  const cafeNames = getUniqueStrings(
    matches.map((match) => match.actualCafeName || match.targetName)
  );
  const links = getUniqueStrings(matches.map((match) => match.link));

  return {
    keyword,
    exposureStatus: matches.length > 0 ? '노출' : '미노출',
    rank: ranks.join(' | '),
    cafeName: cafeNames.join(' | '),
    link: links.join(' | '),
  };
};
