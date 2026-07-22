import type { ExposureResult } from '../../matcher';
import type { CafeMatch } from '../cafe-exposure-check';

export interface CombinedExposureResult {
  exposureStatus: '노출' | '미노출';
  rank: string;
  name: string;
  links: string;
}

const unique = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean)));

export const buildCombinedExposureResult = (
  cafeMatches: CafeMatch[],
  blogMatches: ExposureResult[]
): CombinedExposureResult => {
  const ranks = [
    ...cafeMatches.map(({ cafeRank }) => `카페 ${cafeRank}`),
    ...blogMatches.map(({ position }) => `블로그 ${position}`),
  ];
  const names = [
    ...cafeMatches.map(({ targetName }) => `[카페] ${targetName}`),
    ...blogMatches.map(({ blogName, blogId }) =>
      `[블로그] ${blogName || blogId}`
    ),
  ];
  const links = [
    ...cafeMatches.map(({ link }) => link),
    ...blogMatches.map(({ postLink }) => postLink),
  ];

  return {
    exposureStatus: ranks.length > 0 ? '노출' : '미노출',
    rank: ranks.join(' | '),
    name: unique(names).join(' | '),
    links: unique(links).join(' | '),
  };
};
