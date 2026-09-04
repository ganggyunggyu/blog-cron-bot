import type {
  IPageCheckKeyword,
  PageCheckSheetType,
} from '../../database';
import { saveDetailedLogs } from '../../logs';
import type { ExposureResult } from '../../matcher';
import { summarizeExposureRows } from '../exposure-summary';
import { sendDoorayExposureResult } from '../dooray';
import type { DogmaruCompositeResult } from '../exposure-suite/dogmaru-composite-target';
import { logger } from '../logger';
import type { SheetProcessResult } from './page-keyword-processor';
import {
  PAGE_CHECK_SHEET_TYPE_NAMES,
  PAGE_CHECK_TARGET_NAMES,
} from './config';

interface ReportPageCheckRunInput {
  activeSheetTypes: PageCheckSheetType[];
  sheetLabel: string;
  pageSheetLabel: string;
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>;
  totalPageKeywords: number;
  totalKeywords: number;
  sheetResults: SheetProcessResult[];
  dogmaruResult?: DogmaruCompositeResult;
  allResults: ExposureResult[];
  timestamp: string;
  startedAt: number;
}

const formatDuration = (elapsedMs: number): string => {
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
};

const countExposureTypes = (results: ExposureResult[]) => ({
  popularCount: results.filter((result) => result.exposureType === '인기글').length,
  sblCount: results.filter((result) => result.exposureType === '스블').length,
  newLogicCount: results.filter((result) => result.isNewLogic === true).length,
  oldLogicCount: results.filter((result) => result.isNewLogic === false).length,
});

const logPageCheckSummary = (
  pageSheetLabel: string,
  totalPageKeywords: number,
  allResults: ExposureResult[],
  elapsedTime: string
): void => {
  const { popularCount, sblCount, newLogicCount, oldLogicCount } =
    countExposureTypes(allResults);
  logger.summary.complete(`📄 멀티페이지 크론 [${pageSheetLabel}] 완료 요약`, [
    { label: '총 검색어', value: `${totalPageKeywords}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '신규로직', value: `${newLogicCount}개` },
    { label: '구로직', value: `${oldLogicCount}개` },
    { label: '처리 시간', value: elapsedTime },
  ]);
};

const buildNotificationData = (
  activeSheetTypes: PageCheckSheetType[],
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>,
  sheetResults: SheetProcessResult[],
  dogmaruResult: DogmaruCompositeResult | undefined,
  allResults: ExposureResult[]
) => {
  const pageSummaries = new Map(
    activeSheetTypes.map((sheetType) => [
      sheetType,
      summarizeExposureRows(
        keywordsBySheet[sheetType],
        sheetResults.find((result) => result.sheetType === sheetType)?.results ?? []
      ),
    ])
  );
  const dogmaruSummary = dogmaruResult
    ? summarizeExposureRows(dogmaruResult.keywords, dogmaruResult.results)
    : undefined;
  const results = [...allResults, ...(dogmaruResult?.results ?? [])];

  return {
    results,
    counts: countExposureTypes(results),
    sheetStats: [
      ...activeSheetTypes.map((sheetType) => ({
        name: PAGE_CHECK_SHEET_TYPE_NAMES[sheetType],
        count: pageSummaries.get(sheetType)?.exposedCount ?? 0,
      })),
      ...(dogmaruSummary
        ? [{ name: PAGE_CHECK_TARGET_NAMES.dogmaru, count: dogmaruSummary.exposedCount }]
        : []),
    ].filter((summary) => summary.count > 0),
    missingKeywords: [
      ...activeSheetTypes.flatMap(
        (sheetType) => pageSummaries.get(sheetType)?.missingKeywords ?? []
      ),
      ...(dogmaruSummary?.missingKeywords ?? []),
    ],
  };
};

export const reportPageCheckRun = async ({
  activeSheetTypes,
  sheetLabel,
  pageSheetLabel,
  keywordsBySheet,
  totalPageKeywords,
  totalKeywords,
  sheetResults,
  dogmaruResult,
  allResults,
  timestamp,
  startedAt,
}: ReportPageCheckRunInput): Promise<void> => {
  const elapsedTime = formatDuration(Date.now() - startedAt);
  logPageCheckSummary(
    pageSheetLabel,
    totalPageKeywords,
    allResults,
    elapsedTime
  );
  const notification = buildNotificationData(
    activeSheetTypes,
    keywordsBySheet,
    sheetResults,
    dogmaruResult,
    allResults
  );
  const {
    popularCount: notificationPopularCount,
    sblCount: notificationSblCount,
    newLogicCount: notificationNewLogicCount,
    oldLogicCount: notificationOldLogicCount,
  } = notification.counts;

  await sendDoorayExposureResult({
    cronType: `멀티페이지 크론 [${sheetLabel}]`,
    totalKeywords,
    exposureCount: notification.results.length,
    popularCount: notificationPopularCount,
    sblCount: notificationSblCount,
    elapsedTime,
    sheetStats: notification.sheetStats,
    missingKeywords: notification.missingKeywords,
    newLogicCount: notificationNewLogicCount,
    oldLogicCount: notificationOldLogicCount,
  });

  saveDetailedLogs(
    sheetResults.flatMap((result) => result.logs),
    `pages_${timestamp}`,
    elapsedTime
  );
};
