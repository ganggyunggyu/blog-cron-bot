import { syncKeywords } from '../../api';
import { DOGMARU_PAGE_CHECK_BLOG_IDS } from '../../constants/blog-ids';
import { requests } from '../../constants';
import { getAllKeywords, type IKeyword } from '../../database';
import { saveToCSV, saveToSheetCSV } from '../../csv-writer';
import { createDetailedLogBuilder, saveDetailedLogs } from '../../logs';
import type { ExposureResult } from '../../matcher';
import { getKSTTimestamp } from '../../utils';
import { processKeywords } from '../keyword-processor';
import type { SharedCrawlContext } from '../keyword-processor/types';
import { logger } from '../logger';
import { rewriteOrderedResultSheet } from '../google-sheets/ordered-result-sheet';
import { DOGMARU_COMPOSITE_MAX_PAGES } from './dog-pet-composite';

export interface DogmaruCompositeResult {
  keywords: IKeyword[];
  results: ExposureResult[];
  logs: ReturnType<ReturnType<typeof createDetailedLogBuilder>['getLogs']>;
}

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}분 ${seconds % 60}초` : `${seconds}초`;
};

export const syncAndLoadDogmaruKeywords = async (): Promise<IKeyword[]> => {
  logger.step(1, 3, '도그마루 시트 동기화');
  await syncKeywords(requests[2]);
  logger.step(1, 3, '도그마루 시트 동기화', 'done');

  const allKeywords = await getAllKeywords();
  const dogmaruKeywords = allKeywords.filter(
    (keyword) => keyword.sheetType === 'dogmaru'
  );
  logger.info(`🐕 도그마루 키워드 ${dogmaruKeywords.length}개 처리 예정`);

  return dogmaruKeywords;
};

export const processDogmaruCompositeTarget = async (
  keywords: IKeyword[],
  isLoggedIn: boolean,
  concurrency: number,
  sharedCrawlContext: SharedCrawlContext
): Promise<DogmaruCompositeResult> => {
  logger.step(2, 3, '도그마루 노출 체크');
  const logBuilder = createDetailedLogBuilder();
  const results = await processKeywords(keywords, logBuilder, {
    isLoggedIn,
    maxPages: DOGMARU_COMPOSITE_MAX_PAGES,
    concurrency,
    blogIds: DOGMARU_PAGE_CHECK_BLOG_IDS,
    consumeMatches: true,
    sharedCrawlContext,
    progressTarget: 'dogmaru',
  });
  logger.step(2, 3, '도그마루 노출 체크', 'done');

  return { keywords, results, logs: logBuilder.getLogs() };
};

export const finalizeDogmaruCompositeTarget = async (
  result: DogmaruCompositeResult,
  startedAt: number
): Promise<void> => {
  logger.step(3, 3, '도그마루 시트 반영');
  const rewriteResult = await rewriteOrderedResultSheet(
    'dogmaru',
    result.results,
    undefined,
    result.keywords.map((keyword) => ({
      keyword: keyword.keyword,
      company: keyword.company,
    }))
  );
  const updatedCount = rewriteResult.rowCount;
  logger.result('도그마루', `${updatedCount}건`);
  logger.step(3, 3, '도그마루 시트 반영', 'done');

  const timestamp = getKSTTimestamp();
  saveToCSV(result.results, `results-dogmaru_${timestamp}.csv`);
  saveToSheetCSV(
    result.keywords.map((keyword) => ({
      keyword: keyword.keyword,
      company: keyword.company,
    })),
    result.results,
    `results-dogmaru_sheet_${timestamp}.csv`
  );

  const elapsedTime = formatDuration(Date.now() - startedAt);
  const popularCount = result.results.filter(
    (exposure) => exposure.exposureType === '인기글'
  ).length;
  const sblCount = result.results.filter(
    (exposure) => exposure.exposureType === '스블'
  ).length;

  logger.summary.complete('DOGMARU CRON COMPLETE', [
    { label: '총 검색어', value: `${result.keywords.length}개` },
    { label: '총 노출 발견', value: `${result.results.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '처리 시간', value: elapsedTime },
    { label: '시트 업데이트', value: `${updatedCount}건` },
  ]);

  saveDetailedLogs(result.logs, timestamp, elapsedTime);
};
