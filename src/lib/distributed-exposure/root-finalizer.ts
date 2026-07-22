import { getAllRootKeywords } from '../../database';
import { saveToCSV, saveToSheetCSV } from '../../csv-writer';
import { extractBlogId, type ExposureResult } from '../../matcher';
import { getKSTTimestamp } from '../../utils';
import { sendDoorayExposureResult } from '../dooray';
import { rewriteOrderedResultSheet } from '../google-sheets/ordered-result-sheet';
import { logger } from '../logger';

export const finalizeDistributedRootTarget = async (
  elapsedTime: string
): Promise<void> => {
  const keywords = await getAllRootKeywords();
  const exposed = keywords.filter((keyword) => keyword.visibility);
  const results: ExposureResult[] = exposed.map((keyword) => ({
    query: keyword.keyword,
    company: keyword.company,
    blogId: extractBlogId(keyword.url),
    blogName: '',
    postTitle: keyword.matchedTitle ?? '',
    postLink: keyword.url,
    postPublishedAt: keyword.postPublishedAt,
    exposureType: keyword.popularTopic,
    topicName: keyword.popularTopic,
    position: keyword.rank ?? 0,
    positionWithCafe: keyword.rankWithCafe,
    isNewLogic: keyword.isNewLogic,
    page: keyword.foundPage,
  }));
  const timestamp = getKSTTimestamp();

  saveToCSV(results, `root_${timestamp}.csv`);
  saveToSheetCSV(
    keywords.map(({ keyword, company }) => ({ keyword, company })),
    results,
    `root_sheet_${timestamp}.csv`
  );

  const rewriteResult = await rewriteOrderedResultSheet(
    'root',
    results,
    undefined,
    keywords.map(({ keyword, company }) => ({ keyword, company }))
  );
  logger.info(
    `분산 루트 시트 반영 결과: ${rewriteResult.rowCount}건, 원본 순서 재조회 완료`
  );

  await sendDoorayExposureResult({
    cronType: '루트 키워드',
    totalKeywords: keywords.length,
    exposureCount: results.length,
    popularCount: results.filter(({ exposureType }) => exposureType === '인기글').length,
    sblCount: results.filter(({ exposureType }) => exposureType === '스블').length,
    elapsedTime,
    missingKeywords: keywords
      .filter(({ visibility, isUpdateRequired }) => !visibility && !isUpdateRequired)
      .map(({ keyword }) => keyword),
  });
};
