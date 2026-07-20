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
  SharedCrawlContext,
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
  getIsNewLogicFromItems,
} from './keyword-classifier';
import { getCrawlResult } from './crawl-manager';
import { runGuestRetry } from './guest-retry';
import { TransientExposureCheckError } from './transient-failure';
import { emitExposureProgress } from '../exposure-progress';
import { getExposureKeywordBatchSize } from '../exposure-run-config';
import { chunkByItemBudget } from './keyword-batches';

interface KeywordTask {
  globalIndex: number;
  keywordDoc: KeywordDoc;
}

interface KeywordTaskGroup {
  searchQuery: string;
  tasks: KeywordTask[];
}

interface SearchQueryStateSnapshot {
  matchQueue?: ExposureResult[];
  guestAddedLinks?: Set<string>;
  usedLinks?: Set<string>;
}

interface TransientKeywordRetryBatch {
  groupIndex: number;
  searchQuery: string;
  tasks: KeywordTask[];
  error: TransientExposureCheckError;
}

interface SharedProcessContext {
  totalKeywords: number;
  logBuilder: DetailedLogBuilder;
  updateFunction: UpdateFunction;
  isLoggedIn: boolean;
  maxPages: number;
  blogIds?: string[];
  allowAnyBlog?: boolean;
  consumeMatches: boolean;
  includeGenericBlogResults: boolean;
  keywordLogicMap?: Map<string, boolean>;
  sharedCrawlContext?: SharedCrawlContext;
  caches: CrawlCaches;
  allResults: OrderedExposureResult[];
  reportCompleted: () => void;
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

const cloneExposureResults = (
  results?: ExposureResult[]
): ExposureResult[] | undefined => (results ? [...results] : undefined);

const cloneLinkSet = (
  links?: Set<string>
): Set<string> | undefined => (links ? new Set(links) : undefined);

const captureSearchQueryState = (
  searchQuery: string,
  caches: CrawlCaches
): SearchQueryStateSnapshot => ({
  matchQueue: cloneExposureResults(caches.matchQueueMap.get(searchQuery)),
  guestAddedLinks: cloneLinkSet(
    caches.guestAddedLinksCache.get(searchQuery)
  ),
  usedLinks: cloneLinkSet(caches.usedLinksCache.get(searchQuery)),
});

const restoreSearchQueryState = (
  searchQuery: string,
  caches: CrawlCaches,
  snapshot: SearchQueryStateSnapshot
): void => {
  if (snapshot.matchQueue) {
    caches.matchQueueMap.set(searchQuery, [...snapshot.matchQueue]);
  } else {
    caches.matchQueueMap.delete(searchQuery);
  }

  if (snapshot.guestAddedLinks) {
    caches.guestAddedLinksCache.set(
      searchQuery,
      new Set(snapshot.guestAddedLinks)
    );
  } else {
    caches.guestAddedLinksCache.delete(searchQuery);
  }

  if (snapshot.usedLinks) {
    caches.usedLinksCache.set(searchQuery, new Set(snapshot.usedLinks));
  } else {
    caches.usedLinksCache.delete(searchQuery);
  }
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
    consumeMatches,
    includeGenericBlogResults,
    keywordLogicMap,
    sharedCrawlContext,
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
    allowAnyBlog,
    includeGenericBlogResults,
    sharedCrawlContext
  );

  const { items, isPopular, uniqueGroupsSize, topicNamesArray } = crawlResult;
  const isNewLogic = getIsNewLogicFromItems(items);

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
        includeGenericBlogResults,
        sharedCrawlCoordinator: sharedCrawlContext?.coordinator,
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

  if (consumeMatches && matchedIndex >= 0) {
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
        remainingQueueCount: consumeMatches
          ? matchQueue.length
          : Math.max(matchQueue.length - 1, 0),
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
      includeGenericBlogResults,
      sharedCrawlCoordinator: sharedCrawlContext?.coordinator,
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

const processKeywordTaskWithRollback = async (
  task: KeywordTask,
  shared: SharedProcessContext
): Promise<void> => {
  const searchQuery = getSearchQuery(task.keywordDoc.keyword || '');
  const snapshot = captureSearchQueryState(searchQuery, shared.caches);

  try {
    await processSingleKeyword(task, shared);
  } catch (error) {
    if (error instanceof TransientExposureCheckError) {
      restoreSearchQueryState(searchQuery, shared.caches, snapshot);
    }
    throw error;
  }
};

const runKeywordGroupsWithConcurrency = async (
  groups: KeywordTaskGroup[],
  concurrency: number,
  shared: SharedProcessContext
): Promise<TransientKeywordRetryBatch[]> => {
  const retryBatches: TransientKeywordRetryBatch[] = [];
  let nextGroupIndex = 0;
  const workerCount = Math.min(getEffectiveConcurrency(concurrency), groups.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextGroupIndex < groups.length) {
        const groupIndex = nextGroupIndex;
        nextGroupIndex += 1;
        const group = groups[groupIndex];

        for (const [taskIndex, task] of group.tasks.entries()) {
          try {
            await processKeywordTaskWithRollback(task, shared);
            shared.reportCompleted();
          } catch (error) {
            if (error instanceof TransientExposureCheckError) {
              retryBatches.push({
                groupIndex,
                searchQuery: group.searchQuery,
                tasks: group.tasks.slice(taskIndex),
                error,
              });
              break;
            }
            throw error;
          }
        }
      }
    })
  );

  return retryBatches.sort((left, right) => left.groupIndex - right.groupIndex);
};

const retryTransientKeywordGroups = async (
  retryBatches: readonly TransientKeywordRetryBatch[],
  shared: SharedProcessContext
): Promise<void> => {
  if (retryBatches.length === 0) return;

  const retryKeywordCount = retryBatches.reduce(
    (sum, batch) => sum + batch.tasks.length,
    0
  );
  logger.warn(
    `일시 실패 검색어 ${retryKeywordCount}건을 키워드당 병렬 1로 재실행합니다.`
  );

  for (const batch of retryBatches) {
    logger.warn(
      `↻ "${batch.searchQuery}" 남은 ${batch.tasks.length}건 재실행 (${batch.error.message})`
    );

    for (const [taskIndex, task] of batch.tasks.entries()) {
      try {
        await processKeywordTaskWithRollback(task, shared);
        shared.reportCompleted();
      } catch (error) {
        if (!(error instanceof TransientExposureCheckError)) {
          throw error;
        }

        const deferredCount = batch.tasks.length - taskIndex;
        logger.error(
          `판정 보류: "${batch.searchQuery}" 재시도 실패 (${deferredCount}건, 기존 시트 값 유지)`
        );
        for (let index = 0; index < deferredCount; index += 1) {
          shared.reportCompleted();
        }
        break;
      }
    }
  }
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
  const consumeMatches = options?.consumeMatches ?? true;
  const includeGenericBlogResults = options?.includeGenericBlogResults ?? false;
  const keywordLogicMap = options?.keywordLogicMap;
  const sharedCrawlContext = options?.sharedCrawlContext;
  const progressTarget =
    options?.progressTarget ?? process.env.EXPOSURE_PROGRESS_TARGET;
  const allResults: OrderedExposureResult[] = [];
  let completedKeywords = 0;

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
    consumeMatches,
    includeGenericBlogResults,
    keywordLogicMap,
    sharedCrawlContext,
    caches,
    allResults,
    reportCompleted: () => {
      completedKeywords += 1;
      emitExposureProgress(
        progressTarget,
        completedKeywords,
        keywords.length,
        'running'
      );
    },
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
      await processKeywordTaskWithRollback(
        {
          globalIndex: index + 1,
          keywordDoc,
        },
        shared
      );
      shared.reportCompleted();
    }
  } else {
    const groups = groupKeywordsBySearchQuery(keywords);
    const keywordBatchSize = getExposureKeywordBatchSize();
    const groupBatches = chunkByItemBudget(
      groups,
      keywordBatchSize,
      (group) => group.tasks.length
    );

    logger.info(
      `📦 시트 키워드 ${keywordBatchSize}개 단위 배치: ${groupBatches.length}개`
    );

    for (const [batchIndex, groupBatch] of groupBatches.entries()) {
      logger.info(
        `▶ 배치 ${batchIndex + 1}/${groupBatches.length} (${groupBatch.reduce(
          (sum, group) => sum + group.tasks.length,
          0
        )}개)`
      );
      const retryBatches = await runKeywordGroupsWithConcurrency(
        groupBatch,
        concurrency,
        shared
      );
      await retryTransientKeywordGroups(retryBatches, shared);
    }
  }

  logger.statusLine.done();

  return allResults
    .sort((left, right) => left.globalIndex - right.globalIndex)
    .map(({ result }) => result);
};
