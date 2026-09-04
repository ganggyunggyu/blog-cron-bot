import {
  updatePageCheckKeywordResult,
  type IPageCheckKeyword,
  type PageCheckSheetType,
} from '../../database';
import type { ExposureResult } from '../../matcher';
import type { DetailedLog } from '../../types';
import { PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE } from '../../constants/blog-ids';
import { createDetailedLogBuilder } from '../../logs';
import { processKeywords } from '../keyword-processor';
import type {
  SharedCrawlContext,
  UpdateFunction,
} from '../keyword-processor/types';
import { logger } from '../logger';
import {
  getMaxPagesForPageCheckSheet,
  PAGE_CHECK_SHEET_TYPE_NAMES,
} from './config';

export interface SheetProcessResult {
  sheetType: PageCheckSheetType;
  results: ExposureResult[];
  logs: DetailedLog[];
}

const createUpdateFunction = (
  sheetType: PageCheckSheetType
): UpdateFunction => async (
  keywordId,
  visibility,
  popularTopic,
  url,
  keywordType,
  restaurantName,
  matchedTitle,
  rank,
  postVendorName,
  rankWithCafe,
  isUpdateRequired,
  isNewLogic,
  foundPage,
  postPublishedAt
) => {
  await updatePageCheckKeywordResult(
    sheetType,
    keywordId,
    visibility,
    popularTopic,
    url,
    keywordType,
    restaurantName,
    matchedTitle,
    rank,
    postVendorName,
    rankWithCafe,
    isUpdateRequired,
    isNewLogic,
    foundPage,
    postPublishedAt
  );
};

export const processSheetKeywords = async (
  sheetType: PageCheckSheetType,
  keywords: IPageCheckKeyword[],
  isLoggedIn: boolean,
  concurrency: number,
  keywordLogicMap?: Map<string, boolean>,
  sharedCrawlContext?: SharedCrawlContext
): Promise<SheetProcessResult> => {
  const typeName = PAGE_CHECK_SHEET_TYPE_NAMES[sheetType];
  const maxPages = getMaxPagesForPageCheckSheet(sheetType);
  const logBuilder = createDetailedLogBuilder();

  logger.info(
    `[${typeName}] 🚀 ${keywords.length}개 키워드 처리 시작 (${maxPages}페이지)`
  );

  const results = await processKeywords(keywords, logBuilder, {
    updateFunction: createUpdateFunction(sheetType),
    isLoggedIn,
    maxPages,
    concurrency,
    blogIds: PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE[sheetType],
    allowAnyBlog: false,
    keywordLogicMap,
    consumeMatches: false,
    sharedCrawlContext,
    progressTarget: sheetType,
  });

  logger.success(`[${typeName}] ✅ 완료: ${results.length}개 노출 발견`);

  return { sheetType, results, logs: logBuilder.getLogs() };
};
