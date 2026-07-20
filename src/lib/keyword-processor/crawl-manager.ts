import { randomDelay } from '../../crawler';
import { extractPopularItems, PopularItem } from '../../parser';
import { matchBlogs } from '../../matcher';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { progressLogger } from '../../logs/progress-logger';
import { CRAWL_CONFIG } from '../../constants';
import { BLOG_IDS } from '../../constants/blog-ids';
import { logger } from '../logger';
import { getAllowAnyBlog } from './allow-any-blog';
import {
  KeywordDoc,
  KeywordType,
  CrawlCaches,
  UpdateFunction,
  SharedCrawlContext,
} from './types';
import { extractRestaurantName } from './keyword-classifier';
import { crawlMultiPagesPlaywright } from '../playwright-crawler';
import { appendGenericBlogItems } from './generic-blog-results';
import {
  createSharedCrawlStopPredicate,
  filterSnapshotItemsByMaxPages,
  type SharedCrawlPlan,
  type SharedCrawlSnapshot,
} from './shared-crawl-coordinator';
import {
  assertUsableNaverHtml,
  wrapTransientExposureError,
} from './transient-failure';
import { getLoginRetryAttempts } from '../exposure-run-config';
import { loadSinglePageHtml } from './single-page-loader';

interface CrawlResult {
  items: any[];
  isPopular: boolean;
  uniqueGroupsSize: number;
  topicNamesArray: string[];
}

const createTargetCrawlPlan = (
  maxPages: number,
  blogIds: readonly string[]
): SharedCrawlPlan => ({
  maxPages,
  requirements: [{ maxPages, blogIds }],
});

const loadCrawlSnapshot = async (
  searchQuery: string,
  plan: SharedCrawlPlan,
  includeGenericBlogResults: boolean
): Promise<SharedCrawlSnapshot> => {
  let html: string;
  let items: PopularItem[];
  let topicNamesArray: string[];

  if (plan.maxPages > 1) {
    const htmls = await crawlMultiPagesPlaywright(
      searchQuery,
      plan.maxPages,
      createSharedCrawlStopPredicate(plan)
    );
    htmls.forEach((pageHtml) =>
      assertUsableNaverHtml(pageHtml, searchQuery, 'crawl')
    );
    html = htmls[0];

    const firstPageItems = extractPopularItems(html);
    if (includeGenericBlogResults) {
      appendGenericBlogItems(firstPageItems, html, 1);
    }
    topicNamesArray = Array.from(
      new Set(firstPageItems.map((item: PopularItem) => item.group))
    );

    items = [];
    const seenLinks = new Set<string>();
    htmls.forEach((pageHtml, pageIndex) => {
      const pageNumber = pageIndex + 1;

      if (pageNumber === 1) {
        firstPageItems.forEach((item) => {
          if (seenLinks.has(item.link)) return;
          seenLinks.add(item.link);
          items.push({ ...item, page: pageNumber });
        });
        return;
      }

      appendGenericBlogItems(items, pageHtml, pageNumber);
    });

    logger.info(
      `📄 ${htmls.length}/${plan.maxPages}페이지 크롤링 완료: ${items.length}개 아이템`
    );
  } else {
    html = await loadSinglePageHtml(
      searchQuery,
      getLoginRetryAttempts(CRAWL_CONFIG.maxRetries)
    );
    assertUsableNaverHtml(html, searchQuery, 'crawl');
    items = extractPopularItems(html);
    if (includeGenericBlogResults) {
      appendGenericBlogItems(items, html, 1);
    }
    topicNamesArray = Array.from(new Set(items.map((item) => item.group)));
  }

  const uniqueGroupsSize = new Set(topicNamesArray).size;
  await randomDelay(
    CRAWL_CONFIG.delayBetweenQueries,
    CRAWL_CONFIG.delayBetweenQueries * 2
  );

  return {
    html,
    items,
    isPopular: uniqueGroupsSize === 1,
    uniqueGroupsSize,
    topicNamesArray,
  };
};

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
  blogIds: string[] = BLOG_IDS,
  allowAnyBlogOverride?: boolean,
  includeGenericBlogResults: boolean = false,
  sharedCrawlContext?: SharedCrawlContext
): Promise<CrawlResult> => {
  const { crawlCache, itemsCache, matchQueueMap, htmlStructureCache } = caches;

  let items: any[];
  let isPopular: boolean;
  let uniqueGroupsSize: number;
  let topicNamesArray: string[] = [];

  if (!crawlCache.has(searchQuery)) {
    try {
      const plan =
        sharedCrawlContext?.plans.get(searchQuery) ??
        createTargetCrawlPlan(maxPages, blogIds);
      const cacheKey = `${searchQuery}\u0000generic=${includeGenericBlogResults}`;
      const loadSnapshot = (): Promise<SharedCrawlSnapshot> =>
        loadCrawlSnapshot(searchQuery, plan, includeGenericBlogResults);
      const snapshot = sharedCrawlContext
        ? await sharedCrawlContext.coordinator.getCrawlSnapshot(
            cacheKey,
            loadSnapshot
          )
        : await loadSnapshot();

      const html = snapshot.html;
      items = filterSnapshotItemsByMaxPages(snapshot.items, maxPages);
      isPopular = snapshot.isPopular;
      uniqueGroupsSize = snapshot.uniqueGroupsSize;
      topicNamesArray = snapshot.topicNamesArray;

      const allowAnyBlog = getAllowAnyBlog(
        keywordDoc.sheetType,
        allowAnyBlogOverride
      );

      const allMatches = matchBlogs(query, items, { allowAnyBlog, blogIds });

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
    } catch (error) {
      const transientError = wrapTransientExposureError(error, {
        stage: 'crawl',
        searchQuery,
      });
      logger.error(
        `검색어 "${searchQuery}" 크롤링 에러: ${transientError.message}`
      );

      const restaurantName = extractRestaurantName(keywordDoc, query);

      progressLogger.failure({
        index: globalIndex,
        total: totalKeywords,
        keyword: query,
        restaurantName,
        reason: '크롤링 에러',
      });

      const crawlErrorLog = logBuilder.createCrawlError({
        index: globalIndex,
        keyword: query,
        searchQuery,
        restaurantName,
        vendorTarget: '',
        startTime: keywordStartTime,
        error: transientError,
      });
      logBuilder.push(crawlErrorLog);

      throw transientError;
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
