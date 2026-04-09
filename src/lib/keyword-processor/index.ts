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
  OrderedExposureResult,
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

interface KeywordTask {
  globalIndex: number;
  keywordDoc: KeywordDoc;
}

interface KeywordTaskGroup {
  searchQuery: string;
  tasks: KeywordTask[];
}

interface SharedProcessContext {
  totalKeywords: number;
  logBuilder: DetailedLogBuilder;
  updateFunction: UpdateFunction;
  isLoggedIn: boolean;
  maxPages: number;
  blogIds?: string[];
  allowAnyBlog?: boolean;
  keywordLogicMap?: Map<string, boolean>;
  caches: CrawlCaches;
  allResults: OrderedExposureResult[];
}

const DEFAULT_CONCURRENCY = 1;

const getEffectiveConcurrency = (value?: number): number => {
  if (!Number.isFinite(value) || !value || value < 1) {
    return DEFAULT_CONCURRENCY;
  }

  return Math.floor(value);
};

const groupKeywordsBySearchQuery = (
  keywords: KeywordDoc[]
): KeywordTaskGroup[] => {
  const groups: KeywordTaskGroup[] = [];
  const groupMap = new Map<string, KeywordTaskGroup>();

  keywords.forEach((keywordDoc, index) => {
    const searchQuery = getSearchQuery(keywordDoc.keyword || '');
    const existingGroup = groupMap.get(searchQuery);

    if (existingGroup) {
      existingGroup.tasks.push({
        globalIndex: index + 1,
        keywordDoc,
      });
      return;
    }

    const nextGroup: KeywordTaskGroup = {
      searchQuery,
      tasks: [
        {
          globalIndex: index + 1,
          keywordDoc,
        },
      ],
    };

    groupMap.set(searchQuery, nextGroup);
    groups.push(nextGroup);
  });

  return groups;
};

const processSingleKeyword = async (
  task: KeywordTask,
  shared: SharedProcessContext
): Promise<void> => {
  const { globalIndex, keywordDoc } = task;
  const {
    totalKeywords,
    logBuilder,
    updateFunction,
    isLoggedIn,
    maxPages,
    blogIds,
    allowAnyBlog,
    keywordLogicMap,
    caches,
    allResults,
  } = shared;
  const query = keywordDoc.keyword;
  const searchQuery = getSearchQuery(query || '');
  const keywordStartTime = Date.now();

  logger.statusLine.update(globalIndex, totalKeywords, query);

  const restaurantName = extractRestaurantName(keywordDoc, query);
  const company = String(keywordDoc.company || '').trim();
  const keywordType = getKeywordType(keywordDoc, restaurantName);

  const crawlResult = await getCrawlResult(
    searchQuery,
    keywordDoc,
    query,
    globalIndex,
    totalKeywords,
    keywordStartTime,
    keywordType,
    caches,
    logBuilder,
    updateFunction,
    maxPages,
    blogIds,
    allowAnyBlog
  );

  if (!crawlResult) {
    return;
  }

  const { items, isPopular, uniqueGroupsSize, topicNamesArray } = crawlResult;
  const isNewLogic = getIsNewLogic(topicNamesArray);

  if (keywordLogicMap) {
    keywordLogicMap.set(query, isNewLogic);
  }

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
        totalKeywords,
        keywordStartTime,
        logBuilder,
      },
      updateFunction,
      isNewLogic,
    });
    return;
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
    totalKeywords,
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
        blogIds,
        allowAnyBlog,
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

    return;
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
    return;
  }

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
      blogIds,
      allowAnyBlog,
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
};

const runKeywordGroupsWithConcurrency = async (
  groups: KeywordTaskGroup[],
  concurrency: number,
  shared: SharedProcessContext
): Promise<void> => {
  let nextGroupIndex = 0;
  const workerCount = Math.min(concurrency, groups.length);

  const runWorker = async (): Promise<void> => {
    while (nextGroupIndex < groups.length) {
      const currentGroupIndex = nextGroupIndex;
      nextGroupIndex += 1;

      const group = groups[currentGroupIndex];

      if (!group) {
        return;
      }

      for (const task of group.tasks) {
        await processSingleKeyword(task, shared);
      }
    }
  };

  await Promise.all(
    Array.from({ length: workerCount }, async () => runWorker())
  );
};

export const processKeywords = async (
  keywords: KeywordDoc[],
  logBuilder: DetailedLogBuilder,
  options?: ProcessKeywordsOptions
): Promise<ExposureResult[]> => {
  const updateFunction: UpdateFunction =
    options?.updateFunction ?? updateKeywordResult;
  const isLoggedIn = options?.isLoggedIn ?? false;
  const maxPages = options?.maxPages ?? 1;
  const concurrency = getEffectiveConcurrency(options?.concurrency);
  const blogIds = options?.blogIds;
  const allowAnyBlog = options?.allowAnyBlog;
  const keywordLogicMap = options?.keywordLogicMap;
  const allResults: OrderedExposureResult[] = [];

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

  const shared: SharedProcessContext = {
    totalKeywords: keywords.length,
    logBuilder,
    updateFunction,
    isLoggedIn,
    maxPages,
    blogIds,
    allowAnyBlog,
    keywordLogicMap,
    caches,
    allResults,
  };

  logger.info(`🔍 총 ${keywords.length}개 키워드 처리`);

  if (concurrency > 1) {
    logger.info(
      `⚡ searchQuery 그룹 제한 병렬 처리 활성화: 동시 ${concurrency}개`
    );
  }

  logger.blank();

  if (concurrency === 1 || keywords.length <= 1) {
    for (const [index, keywordDoc] of keywords.entries()) {
      await processSingleKeyword(
        {
          globalIndex: index + 1,
          keywordDoc,
        },
        shared
      );
    }
  } else {
    const groups = groupKeywordsBySearchQuery(keywords);
    await runKeywordGroupsWithConcurrency(groups, concurrency, shared);
  }

  logger.statusLine.done();

  return allResults
    .sort((left, right) => left.globalIndex - right.globalIndex)
    .map(({ result }) => result);
};
