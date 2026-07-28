import { TEST_CONFIG } from '../../constants';
import { getAllKeywords } from '../../database';
import { saveToCSV, saveToSheetCSV } from '../../csv-writer';
import { extractBlogId, type ExposureResult } from '../../matcher';
import { getKSTTimestamp } from '../../utils';
import { sendDoorayExposureResult } from '../dooray';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  openSpreadsheet,
} from '../google-sheets/direct-exposure-sheet';
import type { ExposureTargetId } from '../exposure-suite/options';
import { rewriteOrderedResultSheet, type OrderedResultTarget } from '../google-sheets/ordered-result-sheet';

type DirectTarget = Extract<
  ExposureTargetId,
  'package' | 'general' | 'dogmaru'
>;

const DIRECT_TARGETS: Record<
  DirectTarget,
  { sheetType: string; label: string; resultTarget: OrderedResultTarget; csvPrefix: string }
> = {
  package: { sheetType: 'package', label: '패키지', resultTarget: 'package', csvPrefix: 'distributed-package' },
  general: { sheetType: 'dogmaru-exclude', label: '일반건', resultTarget: 'general', csvPrefix: 'distributed-general' },
  dogmaru: { sheetType: 'dogmaru', label: '도그마루', resultTarget: 'dogmaru', csvPrefix: 'distributed-dogmaru' },
};

const assertSent = (sent: boolean, label: string): void => {
  if (!sent) throw new Error(`${label} Dooray 전송 실패`);
};

const toExposureResult = (keyword: Awaited<ReturnType<typeof getAllKeywords>>[number]): ExposureResult => ({
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
});

export const finalizeDistributedDirectNotification = async (
  target: DirectTarget,
  elapsedTime: string
): Promise<void> => {
  const definition = DIRECT_TARGETS[target];
  const keywords = (await getAllKeywords()).filter(
    ({ sheetType }) => sheetType === definition.sheetType
  );
  const exposed = keywords.filter(({ visibility }) => visibility);
  const results = exposed.map(toExposureResult);
  const timestamp = getKSTTimestamp();
  const logicMap = new Map(
    keywords.map(({ keyword, isNewLogic }) => [keyword, isNewLogic ?? false])
  );
  saveToCSV(results, `${definition.csvPrefix}_${timestamp}.csv`);
  saveToSheetCSV(
    keywords.map(({ keyword, company }) => ({ keyword, company })),
    results,
    `${definition.csvPrefix}_sheet_${timestamp}.csv`,
    logicMap
  );
  await rewriteOrderedResultSheet(
    definition.resultTarget,
    results,
    logicMap,
    keywords.map(({ keyword, company }) => ({ keyword, company }))
  );
  const sent = await sendDoorayExposureResult({
    cronType: definition.label,
    totalKeywords: keywords.length,
    exposureCount: exposed.length,
    popularCount: exposed.filter(
      ({ popularTopic }) => popularTopic === '인기글'
    ).length,
    sblCount: exposed.filter(({ popularTopic }) => popularTopic === '스블')
      .length,
    elapsedTime,
    missingKeywords: keywords
      .filter(
        ({ visibility, isUpdateRequired }) =>
          !visibility && !isUpdateRequired
      )
      .map(({ keyword }) => keyword),
  });
  assertSent(sent, definition.label);
};

export const finalizeDistributedCafeNotification = async (
  elapsedTime: string
): Promise<void> => {
  const doc = await openSpreadsheet(
    TEST_CONFIG.SHEET_ID,
    getGoogleSheetAuth()
  );
  const sheet = getWorksheetByTitle(doc, '카페노출체크');
  await sheet.loadCells(`A1:B${sheet.rowCount}`);
  const rows = Array.from({ length: Math.max(sheet.rowCount - 1, 0) }, (_, i) => ({
    keyword: String(sheet.getCell(i + 1, 0).value ?? '').trim(),
    exposure: String(sheet.getCell(i + 1, 1).value ?? '').trim().toLowerCase(),
  })).filter(({ keyword }) => keyword.length > 0);
  const sent = await sendDoorayExposureResult({
    cronType: '카페노출체크',
    totalKeywords: rows.length,
    exposureCount: rows.filter(({ exposure }) => exposure === 'o').length,
    popularCount: 0,
    sblCount: 0,
    elapsedTime,
    missingKeywords: rows
      .filter(({ exposure }) => exposure !== 'o')
      .map(({ keyword }) => keyword),
  });
  assertSent(sent, '카페노출체크');
};

export const isDistributedDirectTarget = (
  target: ExposureTargetId
): target is DirectTarget => target in DIRECT_TARGETS;
