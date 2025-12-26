import { ExposureResult } from '../../matcher';
import { progressLogger } from '../../logs/progress-logger';
import { fetchResolvedPostHtml } from '../vendor-extractor';
import { checkConsecutiveImages } from '../post-quality-checker';
import {
  ExcludedParams,
  QueueEmptyParams,
  SuccessParams,
  FilterFailureParams,
} from './types';
import { getIsNewLogic } from './keyword-classifier';

export const handleExcluded = async (params: ExcludedParams): Promise<void> => {
  const { keyword, company, processing, updateFunction, isNewLogic } = params;
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
    false,
    isNewLogic
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
  const { keyword, html, processing, updateFunction } = params;
  const {
    keywordDoc,
    query,
    searchQuery,
    restaurantName,
    vendorTarget,
    keywordType,
  } = keyword;
  const { topicNamesArray } = html;
  const { globalIndex, totalKeywords, keywordStartTime, logBuilder } =
    processing;

  const isNewLogic = getIsNewLogic(topicNamesArray);

  progressLogger.failure({
    index: globalIndex,
    total: totalKeywords,
    keyword: query,
    restaurantName,
    reason: '큐 소진',
    queueBefore: 0,
    queueAfter: 0,
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
    false,
    isNewLogic
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
  const { keyword, html, match, processing, allResults, updateFunction, guestRetryComparison } = params;
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
    queueBefore: remainingQueueCount + 1,
    queueAfter: remainingQueueCount,
    isGuestRecovered: guestRetryComparison?.recovered,
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

  const isNewLogic = getIsNewLogic(topicNamesArray);

  await updateFunction(
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
    isUpdateRequired,
    isNewLogic
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
    guestRetryComparison,
  });
  logBuilder.push(successLog);
};

export const handleFilterFailure = async (
  params: FilterFailureParams
): Promise<void> => {
  const { keyword, html, allMatchesCount, remainingQueueCount, processing, updateFunction, guestRetryComparison } =
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

  const isNewLogic = getIsNewLogic(topicNamesArray);

  progressLogger.failure({
    index: globalIndex,
    total: totalKeywords,
    keyword: query,
    restaurantName,
    reason: '필터링 실패',
    queueBefore: remainingQueueCount,
    queueAfter: remainingQueueCount,
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
    false,
    isNewLogic
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
    guestRetryComparison,
  });
  logBuilder.push(filterFailureLog);
};
