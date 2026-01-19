import { crawlWithRetry, randomDelay } from '../../crawler';
import { extractPopularItems, PopularItem } from '../../parser';
import { matchBlogs } from '../../matcher';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { progressLogger } from '../../logs/progress-logger';
import { CRAWL_CONFIG } from '../../constants';
import { BLOG_IDS } from '../../constants/blog-ids';
import { logger } from '../logger';
import { getAllowAnyBlog } from './allow-any-blog';
import { KeywordDoc, KeywordType, CrawlCaches, UpdateFunction } from './types';
import { extractRestaurantName } from './keyword-classifier';
import { crawlMultiPagesPlaywright } from '../playwright-crawler';
import { extractAllBlogLinks } from '../playwright-crawler/blog-extractor';

interface CrawlResult {
  items: any[];
  isPopular: boolean;
  uniqueGroupsSize: number;
  topicNamesArray: string[];
}

export const getCrawlResult = async (
  searchQuery: string,
  keywordDoc: KeywordDoc,
  query: string,
  globalIndex: number,
  totalKeywords: number,
  keywordStartTime: number,
  keywordType: KeywordType,
  caches: CrawlCaches,
  logBuilder: DetailedLogBuilder,
  updateFunction: UpdateFunction,
  maxPages: number = 1,
  blogIds: string[] = BLOG_IDS
): Promise<CrawlResult | null> => {
  const { crawlCache, itemsCache, matchQueueMap, htmlStructureCache } = caches;

  let items: any[];
  let isPopular: boolean;
  let uniqueGroupsSize: number;
  let topicNamesArray: string[] = [];

  if (!crawlCache.has(searchQuery)) {
    try {
      let html: string;

      if (maxPages > 1) {
        const checkBlogMatch = (pageHtml: string): boolean => {
          for (const blogId of blogIds) {
            if (pageHtml.includes(`blog.naver.com/${blogId}/`) ||
                pageHtml.includes(`blog.naver.com/${blogId}"`)) {
              return true;
            }
          }
          return false;
        };

        const htmls = await crawlMultiPagesPlaywright(searchQuery, maxPages, checkBlogMatch);
        html = htmls[0];

        // 1페이지에서 신규로직 여부 먼저 판단
        const firstPageItems = extractPopularItems(html);
        const firstPageGroups = new Set(firstPageItems.map((item: any) => item.group));
        topicNamesArray = Array.from(firstPageGroups);

        const allItems: PopularItem[] = [];
        const seenLinks = new Set<string>();

        htmls.forEach((pageHtml, pageIndex) => {
          const pageNumber = pageIndex + 1;

          if (pageNumber === 1) {
            for (const item of firstPageItems) {
              if (!seenLinks.has(item.link)) {
                seenLinks.add(item.link);
                allItems.push({ ...item, page: pageNumber });
              }
            }
          } else {
            const blogItems = extractAllBlogLinks(pageHtml, pageNumber);
            for (const blogItem of blogItems) {
              if (!seenLinks.has(blogItem.link)) {
                seenLinks.add(blogItem.link);
                allItems.push({
                  title: blogItem.title,
                  link: blogItem.link,
                  snippet: '',
                  image: '',
                  badge: '',
                  group: `검색결과 ${pageNumber}페이지`,
                  blogLink: blogItem.link,
                  blogName: blogItem.blogName,
                  positionWithCafe: undefined,
                  isNewLogic: false,
                  page: pageNumber,
                });
              }
            }
          }
        });

        items = allItems;
        logger.info(`📄 ${maxPages}페이지 크롤링 완료: ${items.length}개 아이템`);
      } else {
        html = await crawlWithRetry(searchQuery, CRAWL_CONFIG.maxRetries);
        items = extractPopularItems(html);
      }

      const allowAnyBlog = getAllowAnyBlog(keywordDoc.sheetType);

      const allMatches = matchBlogs(query, items, { allowAnyBlog });

      // 멀티페이지가 아닐 때만 topicNamesArray 계산 (멀티페이지는 1페이지에서 이미 설정됨)
      if (maxPages <= 1) {
        const uniqueGroups = new Set(items.map((item: any) => item.group));
        topicNamesArray = Array.from(uniqueGroups);
      }

      // isPopular와 uniqueGroupsSize는 1페이지 기준으로 계산
      const firstPageGroups = new Set(topicNamesArray);
      isPopular = firstPageGroups.size === 1;
      uniqueGroupsSize = firstPageGroups.size;

      const typeStr = isPopular ? '인기글' : '스블';
      progressLogger.newCrawl(searchQuery, items.length, allMatches.length, typeStr);

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
