import { ExposureResult } from '../../matcher';
import { crawlWithRetry, delay } from '../../crawler';
import { extractPopularItems } from '../../parser';
import { matchBlogs } from '../../matcher';
import { getSearchQuery } from '../../utils';
import { getSheetOptions, normalizeSheetType } from '../../sheet-config';
import { updateKeywordResult } from '../../database';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { progressLogger } from '../../logs/progress-logger';
import { Config } from '../../types';
import { findMatchingPost } from '../post-filter';
import { fetchResolvedPostHtml } from '../vendor-extractor';
import { checkConsecutiveImages } from '../post-quality-checker';

/**
 * 모든 키워드를 순차적으로 처리 (크롤링, 필터링, 결과 저장)
 */
export const processKeywords = async (
  keywords: any[],
  config: Config,
  logBuilder: DetailedLogBuilder
): Promise<ExposureResult[]> => {
  const allResults: ExposureResult[] = [];

  // 1️⃣ 크롤링 캐시 및 매칭 큐 (searchQuery별)
  const crawlCache = new Map<string, string>();
  const matchQueueMap = new Map<string, ExposureResult[]>();
  const itemsCache = new Map<string, any[]>();
  const htmlStructureCache = new Map<
    string,
    { isPopular: boolean; uniqueGroups: number; topicNames: string[] }
  >();

  console.log(`\n🔍 총 ${keywords.length}개 키워드 처리\n`);

  // 2️⃣ 키워드를 원래 순서대로 하나씩 처리
  let globalIndex = 0;

  for (const keywordDoc of keywords) {
    const query = keywordDoc.keyword;
    const searchQuery = getSearchQuery(query || '');
    globalIndex++;
    const keywordStartTime = Date.now();

    // ⚠️ 프로그램 제외 대상 체크
    const restaurantName = extractRestaurantName(keywordDoc, query);
    const company = String((keywordDoc as any).company || '').trim();
    const keywordType = getKeywordType(keywordDoc, restaurantName);

    if (shouldExclude(company)) {
      await handleExcluded(
        keywordDoc,
        query,
        searchQuery,
        restaurantName,
        company,
        keywordType,
        globalIndex,
        keywords.length,
        keywordStartTime,
        logBuilder
      );
      continue;
    }

    // 3️⃣ 크롤링 또는 캐시 사용
    const crawlResult = await getCrawlResult(
      searchQuery,
      keywordDoc,
      query,
      config,
      globalIndex,
      keywords.length,
      keywordStartTime,
      keywordType,
      crawlCache,
      itemsCache,
      matchQueueMap,
      htmlStructureCache,
      logBuilder
    );

    if (!crawlResult) continue;

    const { items, isPopular, uniqueGroupsSize, topicNamesArray } = crawlResult;

    // 4️⃣ 큐 가져오기
    const matchQueue = matchQueueMap.get(searchQuery)!;
    const allMatchesCount = matchQueue.length;

    // vendorTarget 계산
    const vendorTarget = getVendorTarget(keywordDoc, restaurantName);

    // 5️⃣ 큐가 비었으면 실패 처리
    if (matchQueue.length === 0) {
      await handleQueueEmpty(
        keywordDoc,
        query,
        searchQuery,
        restaurantName,
        vendorTarget,
        keywordType,
        items,
        isPopular,
        uniqueGroupsSize,
        topicNamesArray,
        globalIndex,
        keywords.length,
        keywordStartTime,
        logBuilder
      );
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
    if (passed && nextMatch) {
      await handleSuccess(
        keywordDoc,
        query,
        searchQuery,
        restaurantName,
        vendorTarget,
        keywordType,
        nextMatch,
        extractedVendor,
        matchSource,
        vendorMatchDetails,
        items,
        isPopular,
        uniqueGroupsSize,
        topicNamesArray,
        allMatchesCount,
        matchQueue.length,
        globalIndex,
        keywords.length,
        keywordStartTime,
        logBuilder,
        allResults
      );
    } else {
      await handleFilterFailure(
        keywordDoc,
        query,
        searchQuery,
        restaurantName,
        vendorTarget,
        keywordType,
        items,
        isPopular,
        uniqueGroupsSize,
        topicNamesArray,
        allMatchesCount,
        matchQueue.length,
        globalIndex,
        keywords.length,
        keywordStartTime,
        logBuilder
      );
    }
  }

  return allResults;
};

const extractRestaurantName = (keywordDoc: any, query: string): string => {
  return (
    String((keywordDoc as any).restaurantName || '').trim() ||
    (() => {
      const m = (query || '').match(/\(([^)]+)\)/);
      return m ? m[1].trim() : '';
    })()
  );
};

const shouldExclude = (company: string): boolean => {
  const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
  return normalizedCompany.includes('프로그램');
};

const handleExcluded = async (
  keywordDoc: any,
  query: string,
  searchQuery: string,
  restaurantName: string,
  company: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  globalIndex: number,
  totalKeywords: number,
  keywordStartTime: number,
  logBuilder: DetailedLogBuilder
): Promise<void> => {
  progressLogger.skip({
    index: globalIndex,
    total: totalKeywords,
    keyword: query,
    company,
  });

  await updateKeywordResult(
    String(keywordDoc._id),
    false,
    '',
    '',
    keywordType,
    restaurantName,
    '',
    undefined,
    '',
    undefined
  );

  const excludedLog = logBuilder.createExcluded({
    index: globalIndex,
    keyword: query,
    searchQuery,
    restaurantName,
    vendorTarget: '',
    startTime: keywordStartTime,
  });
  logBuilder.push(excludedLog);
};

const getCrawlResult = async (
  searchQuery: string,
  keywordDoc: any,
  query: string,
  config: Config,
  globalIndex: number,
  totalKeywords: number,
  keywordStartTime: number,
  keywordType: 'restaurant' | 'pet' | 'basic',
  crawlCache: Map<string, string>,
  itemsCache: Map<string, any[]>,
  matchQueueMap: Map<string, ExposureResult[]>,
  htmlStructureCache: Map<
    string,
    { isPopular: boolean; uniqueGroups: number; topicNames: string[] }
  >,
  logBuilder: DetailedLogBuilder
): Promise<{
  items: any[];
  isPopular: boolean;
  uniqueGroupsSize: number;
  topicNamesArray: string[];
} | null> => {
  let items: any[];
  let isPopular: boolean;
  let uniqueGroupsSize: number;
  let topicNamesArray: string[] = [];

  if (!crawlCache.has(searchQuery)) {
    // 첫 크롤링
    progressLogger.newCrawl(searchQuery);

    const sheetOpts = getSheetOptions((keywordDoc as any).sheetType);

    try {
      const html = await crawlWithRetry(searchQuery, config.maxRetries);
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
      console.log(
        `[CRAWL] 파싱: ${items.length}개 → 매칭: ${allMatches.length}개`
      );

      const uniqueGroups = new Set(items.map((item: any) => item.group));
      isPopular = uniqueGroups.size === 1;
      uniqueGroupsSize = uniqueGroups.size;
      topicNamesArray = Array.from(uniqueGroups);
      const topicNamesStr = topicNamesArray.join(', ');
      console.log(
        `[TYPE] ${isPopular ? '인기글 (단일 그룹)' : `스블 (${topicNamesStr})`}`
      );

      // 캐시에 저장
      crawlCache.set(searchQuery, html);
      itemsCache.set(searchQuery, items);
      matchQueueMap.set(searchQuery, [...allMatches]);
      htmlStructureCache.set(searchQuery, {
        isPopular,
        uniqueGroups: uniqueGroupsSize,
        topicNames: topicNamesArray,
      });

      console.log(`[QUEUE] 초기 큐 크기: ${allMatches.length}개\n`);

      await delay(config.delayBetweenQueries);
    } catch (error) {
      console.error(
        `\n❌ 검색어 "${searchQuery}" 크롤링 에러:`,
        (error as Error).message
      );

      const restaurantName = extractRestaurantName(keywordDoc, query);

      progressLogger.failure({
        index: globalIndex,
        total: totalKeywords,
        keyword: query,
        restaurantName,
        reason: '크롤링 에러',
      });

      await updateKeywordResult(
        String(keywordDoc._id),
        false,
        '',
        '',
        keywordType,
        restaurantName,
        '',
        undefined,
        '',
        undefined
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

const getVendorTarget = (keywordDoc: any, restaurantName: string): string => {
  const companyRaw = String((keywordDoc as any).company || '').trim();
  const sheetTypeCanon = normalizeSheetType(
    (keywordDoc as any).sheetType || ''
  );
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const companyNorm = norm(companyRaw);
  const vendorBrand = companyNorm.includes(norm('서리펫'))
    ? '서리펫'
    : sheetTypeCanon === 'dogmaru'
    ? '도그마루'
    : '';
  return restaurantName || vendorBrand;
};

const getKeywordType = (
  keywordDoc: any,
  restaurantName: string
): 'restaurant' | 'pet' | 'basic' => {
  const companyRaw = String((keywordDoc as any).company || '').trim();
  const sheetTypeCanon = normalizeSheetType(
    (keywordDoc as any).sheetType || ''
  );
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const companyNorm = norm(companyRaw);

  // 1. restaurantName이 있으면 restaurant
  if (restaurantName) return 'restaurant';

  // 2. 서리펫 또는 도그마루면 pet
  if (companyNorm.includes(norm('서리펫')) || sheetTypeCanon === 'dogmaru') {
    return 'pet';
  }

  // 3. 나머지는 basic
  return 'basic';
};

const handleQueueEmpty = async (
  keywordDoc: any,
  query: string,
  searchQuery: string,
  restaurantName: string,
  vendorTarget: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  items: any[],
  isPopular: boolean,
  uniqueGroupsSize: number,
  topicNamesArray: string[],
  globalIndex: number,
  totalKeywords: number,
  keywordStartTime: number,
  logBuilder: DetailedLogBuilder
): Promise<void> => {
  progressLogger.failure({
    index: globalIndex,
    total: totalKeywords,
    keyword: query,
    restaurantName,
    reason: '큐 소진',
  });

  await updateKeywordResult(
    String(keywordDoc._id),
    false,
    '',
    '',
    keywordType,
    restaurantName,
    '',
    undefined,
    '',
    undefined
  );

  const queueEmptyLog = logBuilder.createFailure({
    index: globalIndex,
    keyword: query,
    searchQuery,
    restaurantName,
    vendorTarget,
    startTime: keywordStartTime,
    reason: '매칭 큐 소진 (이전 키워드에 모두 할당됨)',
  });
  logBuilder.push(queueEmptyLog);
};

const handleSuccess = async (
  keywordDoc: any,
  query: string,
  searchQuery: string,
  restaurantName: string,
  vendorTarget: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  nextMatch: ExposureResult,
  extractedVendor: string,
  matchSource: 'VENDOR' | 'TITLE' | '',
  vendorMatchDetails: any,
  items: any[],
  isPopular: boolean,
  uniqueGroupsSize: number,
  topicNamesArray: string[],
  allMatchesCount: number,
  remainingQueueCount: number,
  globalIndex: number,
  totalKeywords: number,
  keywordStartTime: number,
  logBuilder: DetailedLogBuilder,
  allResults: ExposureResult[]
): Promise<void> => {
  const displayRank = nextMatch.position ?? '-';
  const displayTitle = nextMatch.postTitle || '-';
  const displayTopic = nextMatch.topicName || nextMatch.exposureType || '-';

  progressLogger.success({
    index: globalIndex,
    total: totalKeywords,
    keyword: query,
    restaurantName,
    rank: displayRank,
    topic: displayTopic,
    vendor: extractedVendor || '-',
    title: displayTitle,
    source: matchSource,
  });

  // 🍽️ 식당 키워드인 경우: 포스트 품질 체크 (연속된 이미지 4개 이상 = 수정 필요)
  let isUpdateRequired: boolean | undefined = undefined;
  if (keywordType === 'restaurant') {
    try {
      const postHtml = await fetchResolvedPostHtml(nextMatch.postLink);
      isUpdateRequired = checkConsecutiveImages(postHtml);
    } catch (err) {
      console.warn(
        `  [품질 체크 실패] ${query}: ${(err as Error).message || 'Unknown error'}`
      );
    }
  }

  await updateKeywordResult(
    String(keywordDoc._id),
    true,
    nextMatch.topicName || nextMatch.exposureType,
    nextMatch.postLink,
    keywordType,
    restaurantName,
    nextMatch.postTitle,
    nextMatch.position,
    extractedVendor,
    nextMatch.positionWithCafe,
    isUpdateRequired
  );

  allResults.push(nextMatch);

  const successLog = logBuilder.createSuccess({
    index: globalIndex,
    keyword: query,
    searchQuery,
    restaurantName,
    vendorTarget,
    startTime: keywordStartTime,
    totalItemsParsed: items.length,
    htmlStructure: {
      isPopular,
      uniqueGroups: uniqueGroupsSize,
      topicNames: topicNamesArray,
    },
    allMatchesCount: allMatchesCount + 1,
    availableMatchesCount: remainingQueueCount + 1,
    matchSource: matchSource as 'VENDOR' | 'TITLE',
    matchedPost: {
      blogName: nextMatch.blogName,
      blogId: nextMatch.blogId,
      postTitle: nextMatch.postTitle,
      postLink: nextMatch.postLink,
      position: nextMatch.position ?? 0,
      positionWithCafe: nextMatch.positionWithCafe,
      topicName: nextMatch.topicName || '',
      exposureType: nextMatch.exposureType,
      extractedVendor,
    },
    vendorMatchDetails,
  });
  logBuilder.push(successLog);
};

const handleFilterFailure = async (
  keywordDoc: any,
  query: string,
  searchQuery: string,
  restaurantName: string,
  vendorTarget: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  items: any[],
  isPopular: boolean,
  uniqueGroupsSize: number,
  topicNamesArray: string[],
  allMatchesCount: number,
  remainingQueueCount: number,
  globalIndex: number,
  totalKeywords: number,
  keywordStartTime: number,
  logBuilder: DetailedLogBuilder
): Promise<void> => {
  progressLogger.failure({
    index: globalIndex,
    total: totalKeywords,
    keyword: query,
    restaurantName,
    reason: '필터링 실패',
  });

  await updateKeywordResult(
    String(keywordDoc._id),
    false,
    '',
    '',
    keywordType,
    restaurantName,
    '',
    undefined,
    '',
    undefined
  );

  const filterFailureLog = logBuilder.createFilterFailure({
    index: globalIndex,
    keyword: query,
    searchQuery,
    restaurantName,
    vendorTarget,
    startTime: keywordStartTime,
    totalItemsParsed: items.length,
    htmlStructure: {
      isPopular,
      uniqueGroups: uniqueGroupsSize,
      topicNames: topicNamesArray,
    },
    allMatchesCount,
    availableMatchesCount: remainingQueueCount,
    hasVendorTarget: !!vendorTarget,
  });
  logBuilder.push(filterFailureLog);
};
