import axios from 'axios';
import { getAllRootKeywords } from '../../database';
import { saveToCSV, saveToSheetCSV } from '../../csv-writer';
import { extractBlogId, type ExposureResult } from '../../matcher';
import { SHEET_APP_URL, TEST_CONFIG } from '../../constants';
import { getKSTTimestamp } from '../../utils';
import { sendDoorayExposureResult } from '../dooray';
import { assertWritableSheetId } from '../google-sheets/write-target-guard';
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

  assertWritableSheetId(TEST_CONFIG.SHEET_ID, '분산 루트 결과 반영');
  const response = await axios.post(`${SHEET_APP_URL}/api/root-keywords/import`, {
    expectedSheetId: TEST_CONFIG.SHEET_ID,
    expectedSheetName: TEST_CONFIG.SHEET_NAMES.ROOT,
  });
  logger.info(`분산 루트 시트 반영 결과: ${JSON.stringify(response.data)}`);

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
