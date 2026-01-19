import { ExposureResult } from '../../matcher';
import { updateKeywordResult } from '../../database';
import { getSearchQuery } from '../../utils';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { findMatchingPost } from '../post-filter';
import { logger } from '../logger';
import { GuestRetryComparison } from '../../types';
import {
  KeywordDoc,
  KeywordContext,
  ProcessingContext,
  HtmlStructure,
  CrawlCaches,
  ProcessKeywordsOptions,
  UpdateFunction,
} from './types';
import {
  handleExcluded,
  handleQueueEmpty,
  handleSuccess,
  handleFilterFailure,
} from './handlers';
import {
  extractRestaurantName,
  shouldExclude,
  getKeywordType,
  getVendorTarget,
  getIsNewLogic,
} from './keyword-classifier';
import { getCrawlResult } from './crawl-manager';
import { runGuestRetry } from './guest-retry';

export const processKeywords = async (
  keywords: KeywordDoc[],
  logBuilder: DetailedLogBuilder,
  options?: ProcessKeywordsOptions
): Promise<ExposureResult[]> => {
  const updateFunction: UpdateFunction =
    options?.updateFunction ?? updateKeywordResult;
  const isLoggedIn = options?.isLoggedIn ?? false;
  const maxPages = options?.maxPages ?? 1;
  const blogIds = options?.blogIds;
  const allResults: ExposureResult[] = [];

  const caches: CrawlCaches = {
    crawlCache: new Map<string, string>(),
    matchQueueMap: new Map<string, ExposureResult[]>(),
    itemsCache: new Map<string, any[]>(),
    htmlStructureCache: new Map<
      string,
      { isPopular: boolean; uniqueGroups: number; topicNames: string[] }
    >(),
    guestAddedLinksCache: new Map<string, Set<string>>(),
    usedLinksCache: new Map<string, Set<string>>(),
  };

  logger.info(`🔍 총 ${keywords.length}개 키워드 처리`);
  logger.blank();

  let globalIndex = 0;

  for (const keywordDoc of keywords) {
    const query = keywordDoc.keyword;
    const searchQuery = getSearchQuery(query || '');
    globalIndex++;
    const keywordStartTime = Date.now();

    logger.statusLine.update(globalIndex, keywords.length, query);

    const restaurantName = extractRestaurantName(keywordDoc, query);
    const company = String(keywordDoc.company || '').trim();
    const keywordType = getKeywordType(keywordDoc, restaurantName);

    const crawlResult = await getCrawlResult(
      searchQuery,
      keywordDoc,
      query,
      globalIndex,
      keywords.length,
      keywordStartTime,
      keywordType,
      caches,
      logBuilder,
      updateFunction,
      maxPages,
      blogIds
    );

    if (!crawlResult) continue;

    const { items, isPopular, uniqueGroupsSize, topicNamesArray } = crawlResult;
    const isNewLogic = getIsNewLogic(topicNamesArray);

    if (shouldExclude(company, query)) {
      await handleExcluded({
        keyword: {
          keywordDoc,
          query,
          searchQuery,
          restaurantName,
          vendorTarget: '',
          keywordType,
        },
        company,
        processing: {
          globalIndex,
          totalKeywords: keywords.length,
          keywordStartTime,
          logBuilder,
        },
        updateFunction,
        isNewLogic,
      });
      continue;
    }

    const matchQueue = caches.matchQueueMap.get(searchQuery)!;
    const allMatchesCount = matchQueue.length;

    const vendorTarget = getVendorTarget(keywordDoc, restaurantName);

    const keywordCtx: KeywordContext = {
      keywordDoc,
      query,
      searchQuery,
      restaurantName,
      vendorTarget,
      keywordType,
    };
    const htmlCtx: HtmlStructure = {
      items,
      isPopular,
      uniqueGroupsSize,
      topicNamesArray,
    };
    const processingCtx: ProcessingContext = {
      globalIndex,
      totalKeywords: keywords.length,
      keywordStartTime,
      logBuilder,
    };

    if (matchQueue.length === 0) {
      let queueEmptyRetrySuccess = false;
      if (isLoggedIn) {
        const existingLinks = new Set(items.map((item: any) => item.link));
        const guestRetryResult = await runGuestRetry({
          searchQuery,
          query,
          keywordDoc,
          topicNamesArray,
          matchQueue,
          vendorTarget,
          restaurantName,
          caches,
          baseMatchesCount: 0,
          existingLinks,
        });

        if (guestRetryResult.recovered && guestRetryResult.retryResult?.match) {
          const { match, vendor, source, vendorDetails } =
            guestRetryResult.retryResult;

          if (!caches.usedLinksCache.has(searchQuery)) {
            caches.usedLinksCache.set(searchQuery, new Set());
          }
          caches.usedLinksCache.get(searchQuery)!.add(match.postLink);

          await handleSuccess({
            keyword: keywordCtx,
            html: htmlCtx,
            match: {
              nextMatch: match,
              extractedVendor: vendor,
              matchSource: source,
              vendorMatchDetails: vendorDetails,
              allMatchesCount: guestRetryResult.guestMatchesCount,
              remainingQueueCount: matchQueue.length,
            },
            processing: processingCtx,
            allResults,
            updateFunction,
            guestRetryComparison: guestRetryResult.guestRetryComparison,
          });
          queueEmptyRetrySuccess = true;
        }
      }

      if (!queueEmptyRetrySuccess) {
        await handleQueueEmpty({
          keyword: keywordCtx,
          html: htmlCtx,
          processing: processingCtx,
          updateFunction,
        });
      }
      continue;
    }

    const filterResult = await findMatchingPost(
      matchQueue,
      vendorTarget,
      restaurantName
    );

    let {
      matchedIndex,
      match: nextMatch,
      passed,
      source: matchSource,
      vendor: extractedVendor,
      vendorDetails: vendorMatchDetails,
    } = filterResult;

    if (matchedIndex >= 0) {
      matchQueue.splice(matchedIndex, 1);
    }

    if (passed && nextMatch) {
      if (!caches.usedLinksCache.has(searchQuery)) {
        caches.usedLinksCache.set(searchQuery, new Set());
      }
      caches.usedLinksCache.get(searchQuery)!.add(nextMatch.postLink);

      await handleSuccess({
        keyword: keywordCtx,
        html: htmlCtx,
        match: {
          nextMatch,
          extractedVendor,
          matchSource,
          vendorMatchDetails,
          allMatchesCount,
          remainingQueueCount: matchQueue.length,
        },
        processing: processingCtx,
        allResults,
        updateFunction,
      });
    } else {
      let retrySuccess = false;
      let guestRetryInfo: GuestRetryComparison | undefined;
      if (isLoggedIn) {
        const existingLinks = new Set(matchQueue.map((match) => match.postLink));
        const guestRetryResult = await runGuestRetry({
          searchQuery,
          query,
          keywordDoc,
          topicNamesArray,
          matchQueue,
          vendorTarget,
          restaurantName,
          caches,
          baseMatchesCount: allMatchesCount,
          existingLinks,
          logNewMatches: true,
        });

        guestRetryInfo = guestRetryResult.guestRetryComparison;

        if (guestRetryResult.recovered && guestRetryResult.retryResult?.match) {
          const { match, vendor, source, vendorDetails } =
            guestRetryResult.retryResult;

          if (!caches.usedLinksCache.has(searchQuery)) {
            caches.usedLinksCache.set(searchQuery, new Set());
          }
          caches.usedLinksCache.get(searchQuery)!.add(match.postLink);

          await handleSuccess({
            keyword: keywordCtx,
            html: htmlCtx,
            match: {
              nextMatch: match,
              extractedVendor: vendor,
              matchSource: source,
              vendorMatchDetails: vendorDetails,
              allMatchesCount:
                allMatchesCount + guestRetryResult.addedMatchesCount,
              remainingQueueCount: matchQueue.length,
            },
            processing: processingCtx,
            allResults,
            updateFunction,
            guestRetryComparison: guestRetryInfo,
          });
          retrySuccess = true;
        }
      }

      if (!retrySuccess) {
        await handleFilterFailure({
          keyword: keywordCtx,
          html: htmlCtx,
          allMatchesCount,
          remainingQueueCount: matchQueue.length,
          processing: processingCtx,
          updateFunction,
          guestRetryComparison: guestRetryInfo,
        });
      }
    }
  }

  logger.statusLine.done();

  return allResults;
};
