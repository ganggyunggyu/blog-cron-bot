import { crawlWithRetry, randomDelay } from '../../crawler';
import { extractPopularItems } from '../../parser';
import { matchBlogs } from '../../matcher';
import { getSheetOptions } from '../../sheet-config';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { progressLogger } from '../../logs/progress-logger';
import { CRAWL_CONFIG } from '../../constants';
import { logger } from '../logger';
import { KeywordType, CrawlCaches, UpdateFunction } from './types';
import { extractRestaurantName } from './keyword-classifier';

interface CrawlResult {
  items: any[];
  isPopular: boolean;
  uniqueGroupsSize: number;
  topicNamesArray: string[];
}

export const getCrawlResult = async (
  searchQuery: string,
  keywordDoc: any,
  query: string,
  globalIndex: number,
  totalKeywords: number,
  keywordStartTime: number,
  keywordType: KeywordType,
  caches: CrawlCaches,
  logBuilder: DetailedLogBuilder,
  updateFunction: UpdateFunction
): Promise<CrawlResult | null> => {
  const { crawlCache, itemsCache, matchQueueMap, htmlStructureCache } = caches;

  let items: any[];
  let isPopular: boolean;
  let uniqueGroupsSize: number;
  let topicNamesArray: string[] = [];

  if (!crawlCache.has(searchQuery)) {
    // 첫 크롤링
    const sheetOpts = getSheetOptions((keywordDoc as any).sheetType);

    try {
      const html = await crawlWithRetry(searchQuery, CRAWL_CONFIG.maxRetries);
      items = extractPopularItems(html);

      const allowAnyEnv = String(
        process.env.ALLOW_ANY_BLOG || ''
      ).toLowerCase();
      const allowAnyBlog =
        allowAnyEnv === 'true'
          ? true
          : allowAnyEnv === '1'
          ? true
          : allowAnyEnv === 'false'
          ? false
          : allowAnyEnv === '0'
          ? false
          : !!sheetOpts.allowAnyBlog;

      const allMatches = matchBlogs(query, items, { allowAnyBlog });

      const uniqueGroups = new Set(items.map((item: any) => item.group));
      isPopular = uniqueGroups.size === 1;
      uniqueGroupsSize = uniqueGroups.size;
      topicNamesArray = Array.from(uniqueGroups);

      // 크롤링 결과 한 줄로 출력
      const typeStr = isPopular ? '인기글' : '스블';
      progressLogger.newCrawl(searchQuery, items.length, allMatches.length, typeStr);

      // 캐시에 저장
      crawlCache.set(searchQuery, html);
      itemsCache.set(searchQuery, items);
      matchQueueMap.set(searchQuery, [...allMatches]);
      htmlStructureCache.set(searchQuery, {
        isPopular,
        uniqueGroups: uniqueGroupsSize,
        topicNames: topicNamesArray,
      });

      progressLogger.queueChange(0, allMatches.length, 'init');

      await randomDelay(CRAWL_CONFIG.delayBetweenQueries, CRAWL_CONFIG.delayBetweenQueries * 2);
    } catch (error) {
      logger.error(`검색어 "${searchQuery}" 크롤링 에러: ${(error as Error).message}`);

      const restaurantName = extractRestaurantName(keywordDoc, query);

      progressLogger.failure({
        index: globalIndex,
        total: totalKeywords,
        keyword: query,
        restaurantName,
        reason: '크롤링 에러',
      });

      await updateFunction(
        String(keywordDoc._id),
        false,
        '',
        '',
        keywordType,
        restaurantName,
        '',
        0,
        '',
        0,
        false
      );

      const crawlErrorLog = logBuilder.createCrawlError({
        index: globalIndex,
        keyword: query,
        searchQuery,
        restaurantName,
        vendorTarget: '',
        startTime: keywordStartTime,
        error: error as Error,
      });
      logBuilder.push(crawlErrorLog);

      return null;
    }
  } else {
    // 캐시 사용
    progressLogger.cacheUsed({
      index: globalIndex,
      total: totalKeywords,
      searchQuery,
    });
    items = itemsCache.get(searchQuery)!;
    const structure = htmlStructureCache.get(searchQuery)!;
    isPopular = structure.isPopular;
    uniqueGroupsSize = structure.uniqueGroups;
    topicNamesArray = structure.topicNames;
  }

  return { items, isPopular, uniqueGroupsSize, topicNamesArray };
};
