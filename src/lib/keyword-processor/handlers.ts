import { ExposureResult } from '../../matcher';
import { updateKeywordResult } from '../../database';
import { progressLogger } from '../../logs/progress-logger';
import { fetchResolvedPostHtml } from '../vendor-extractor';
import { checkConsecutiveImages } from '../post-quality-checker';
import {
  ExcludedParams,
  QueueEmptyParams,
  SuccessParams,
  FilterFailureParams,
} from './types';

export const handleExcluded = async (params: ExcludedParams): Promise<void> => {
  const { keyword, company, processing } = params;
  const { keywordDoc, query, searchQuery, restaurantName, keywordType } =
    keyword;
  const { globalIndex, totalKeywords, keywordStartTime, logBuilder } =
    processing;

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

export const handleQueueEmpty = async (
  params: QueueEmptyParams
): Promise<void> => {
  const { keyword, processing } = params;
  const {
    keywordDoc,
    query,
    searchQuery,
    restaurantName,
    vendorTarget,
    keywordType,
  } = keyword;
  const { globalIndex, totalKeywords, keywordStartTime, logBuilder } =
    processing;

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

export const handleSuccess = async (params: SuccessParams): Promise<void> => {
  const { keyword, html, match, processing, allResults } = params;
  const {
    keywordDoc,
    query,
    searchQuery,
    restaurantName,
    vendorTarget,
    keywordType,
  } = keyword;
  const { items, isPopular, uniqueGroupsSize, topicNamesArray } = html;
  const {
    nextMatch,
    extractedVendor,
    matchSource,
    vendorMatchDetails,
    allMatchesCount,
    remainingQueueCount,
  } = match;
  const { globalIndex, totalKeywords, keywordStartTime, logBuilder } =
    processing;

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

  let isUpdateRequired: boolean | undefined = undefined;
  if (keywordType === 'restaurant') {
    try {
      const postHtml = await fetchResolvedPostHtml(nextMatch.postLink);
      isUpdateRequired = checkConsecutiveImages(postHtml);
    } catch (err) {
      console.warn(
        `  [품질 체크 실패] ${query}: ${
          (err as Error).message || 'Unknown error'
        }`
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

export const handleFilterFailure = async (
  params: FilterFailureParams
): Promise<void> => {
  const { keyword, html, allMatchesCount, remainingQueueCount, processing } =
    params;
  const {
    keywordDoc,
    query,
    searchQuery,
    restaurantName,
    vendorTarget,
    keywordType,
  } = keyword;
  const { items, isPopular, uniqueGroupsSize, topicNamesArray } = html;
  const { globalIndex, totalKeywords, keywordStartTime, logBuilder } =
    processing;

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
