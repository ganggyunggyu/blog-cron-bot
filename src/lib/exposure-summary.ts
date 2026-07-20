import type { ExposureResult } from '../matcher';

export interface ExposureSummaryKeyword {
  keyword: string;
  company?: string;
  isUpdateRequired?: boolean;
}

export interface ExposureRowSummary {
  exposedCount: number;
  missingKeywords: string[];
}

const scopedKey = (keyword: string, company: string): string =>
  `${keyword}\u0000${company}`;

const increment = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

const consume = (counts: Map<string, number>, key: string): boolean => {
  const count = counts.get(key) ?? 0;
  if (count === 0) return false;
  if (count === 1) counts.delete(key);
  else counts.set(key, count - 1);
  return true;
};

export const summarizeExposureRows = (
  keywords: readonly ExposureSummaryKeyword[],
  results: readonly ExposureResult[]
): ExposureRowSummary => {
  const scopedCounts = new Map<string, number>();
  const unscopedCounts = new Map<string, number>();

  results.forEach((result) => {
    const company = String(result.company ?? '').trim();
    if (company) {
      increment(scopedCounts, scopedKey(result.query, company));
    } else {
      increment(unscopedCounts, result.query);
    }
  });

  let exposedCount = 0;
  const missingKeywords: string[] = [];

  keywords.forEach((keyword) => {
    const company = String(keyword.company ?? '').trim();
    const exposed =
      (company.length > 0 &&
        consume(scopedCounts, scopedKey(keyword.keyword, company))) ||
      consume(unscopedCounts, keyword.keyword);

    if (exposed) {
      exposedCount += 1;
    } else if (!keyword.isUpdateRequired) {
      missingKeywords.push(keyword.keyword);
    }
  });

  return { exposedCount, missingKeywords };
};
