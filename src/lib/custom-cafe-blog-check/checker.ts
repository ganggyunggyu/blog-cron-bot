import { BLOG_IDS } from '../../constants';
import {
  crawlWithRetry,
  crawlWithRetryWithoutCookie,
  randomDelay,
} from '../../crawler';
import { matchBlogs } from '../../matcher';
import { extractPopularItems } from '../../parser';
import { buildCombinedExposureResult } from '../cafe-blog-combined-result';
import { type CafeTarget, matchCafeTargets } from '../cafe-exposure-check';
import { emitExposureProgress } from '../exposure-progress';
import type { CustomExposureCheckedResult } from './types';

const checkKeyword = async (
  keyword: string,
  targets: CafeTarget[]
): Promise<CustomExposureCheckedResult> => {
  try {
    let html: string;
    try {
      html = await crawlWithRetry(keyword, 1);
    } catch {
      await randomDelay(900, 1400);
      html = await crawlWithRetryWithoutCookie(keyword, 1);
    }
    const items = extractPopularItems(html, { includeCafe: true });
    return buildCombinedExposureResult(
      matchCafeTargets(items, targets),
      matchBlogs(keyword, items, { blogIds: [...BLOG_IDS] })
    );
  } catch (error) {
    return {
      exposureStatus: '확인실패',
      rank: '',
      name: (error as Error).message || 'Unknown error',
      links: '',
    };
  }
};

export const runCustomExposureChecks = async (
  keywords: string[],
  targets: CafeTarget[],
  concurrency = 8
): Promise<Map<string, CustomExposureCheckedResult>> => {
  const results = new Map<string, CustomExposureCheckedResult>();
  let nextIndex = 0;
  let completed = 0;
  const requestedConcurrency = Number.isFinite(concurrency)
    ? Math.floor(concurrency)
    : 8;
  const workerCount = Math.min(
    Math.max(1, requestedConcurrency),
    keywords.length
  );
  const worker = async (): Promise<void> => {
    while (nextIndex < keywords.length) {
      const index = nextIndex++;
      const keyword = keywords[index];
      results.set(keyword, await checkKeyword(keyword, targets));
      completed += 1;
      emitExposureProgress('cafe', completed, keywords.length, 'running');
      await randomDelay(250, 500);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  for (const keyword of keywords) {
    if (results.get(keyword)?.exposureStatus !== '확인실패') continue;
    await randomDelay(900, 1400);
    results.set(keyword, await checkKeyword(keyword, targets));
  }
  return results;
};
