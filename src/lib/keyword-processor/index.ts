import { ExposureResult } from '../../matcher';
import { updateKeywordResult } from '../../database';
import { getSearchQuery } from '../../utils';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { findMatchingPost } from '../post-filter';
import {
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

/**
 * 모든 키워드를 순차적으로 처리 (크롤링, 필터링, 결과 저장)
 */
export const processKeywords = async (
  keywords: any[],
  logBuilder: DetailedLogBuilder,
  options?: ProcessKeywordsOptions
): Promise<ExposureResult[]> => {
  const updateFunction: UpdateFunction =
    options?.updateFunction ?? updateKeywordResult;
  const allResults: ExposureResult[] = [];

  // 1️⃣ 크롤링 캐시 및 매칭 큐 (searchQuery별)
  const caches: CrawlCaches = {
    crawlCache: new Map<string, string>(),
    matchQueueMap: new Map<string, ExposureResult[]>(),
    itemsCache: new Map<string, any[]>(),
    htmlStructureCache: new Map<
      string,
      { isPopular: boolean; uniqueGroups: number; topicNames: string[] }
    >(),
  };

  console.log(`\n🔍 총 ${keywords.length}개 키워드 처리\n`);

  // 2️⃣ 키워드를 원래 순서대로 하나씩 처리
  let globalIndex = 0;

  for (const keywordDoc of keywords) {
    const query = keywordDoc.keyword;
    const searchQuery = getSearchQuery(query || '');
    globalIndex++;
    const keywordStartTime = Date.now();

    const restaurantName = extractRestaurantName(keywordDoc, query);
    const company = String((keywordDoc as any).company || '').trim();
    const keywordType = getKeywordType(keywordDoc, restaurantName);

    // 3️⃣ 크롤링 먼저 실행 (isNewLogic 판단을 위해)
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
      updateFunction
    );

    if (!crawlResult) continue;

    const { items, isPopular, uniqueGroupsSize, topicNamesArray } = crawlResult;
    const isNewLogic = getIsNewLogic(topicNamesArray);

    // ⚠️ 프로그램 제외 대상 체크 (크롤링 후 판단)
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

    // 4️⃣ 큐 가져오기
    const matchQueue = caches.matchQueueMap.get(searchQuery)!;
    const allMatchesCount = matchQueue.length;

    // vendorTarget 계산
    const vendorTarget = getVendorTarget(keywordDoc, restaurantName);

    // 5️⃣ 큐가 비었으면 실패 처리
    if (matchQueue.length === 0) {
      await handleQueueEmpty({
        keyword: {
          keywordDoc,
          query,
          searchQuery,
          restaurantName,
          vendorTarget,
          keywordType,
        },
        html: { items, isPopular, uniqueGroupsSize, topicNamesArray },
        processing: {
          globalIndex,
          totalKeywords: keywords.length,
          keywordStartTime,
          logBuilder,
        },
        updateFunction,
      });
      continue;
    }

    // 6️⃣, 7️⃣ 필터링
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

    // 큐에서 제거
    if (matchedIndex >= 0) {
      matchQueue.splice(matchedIndex, 1);
    }

    // 8️⃣ 결과 처리
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

    if (passed && nextMatch) {
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
      await handleFilterFailure({
        keyword: keywordCtx,
        html: htmlCtx,
        allMatchesCount,
        remainingQueueCount: matchQueue.length,
        processing: processingCtx,
        updateFunction,
      });
    }
  }

  return allResults;
};
