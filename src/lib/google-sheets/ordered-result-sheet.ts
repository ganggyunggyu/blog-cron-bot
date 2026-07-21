import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { TEST_CONFIG } from '../../constants';
import type { ExposureResult } from '../../matcher';
import { buildSheetRows, type SheetCellValue } from '../csv-output';
import type { KeywordInfo } from '../csv-output';
import { logger } from '../logger';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  loadKeywordsFromWorksheet,
  openSpreadsheet,
} from './direct-exposure-sheet';
import { assertWritableSheetId } from './write-target-guard';
import {
  getOrderedResultConfig,
  OrderedResultTarget,
  selectIncludedKeywordsInSourceOrder,
} from './ordered-result-order';

export {
  ORDERED_RESULT_TARGETS,
  OrderedResultTarget,
  selectIncludedKeywordsInSourceOrder,
} from './ordered-result-order';

const RESULT_COLUMN_COUNT = 12;

const writeRows = async (
  sheet: GoogleSpreadsheetWorksheet,
  rows: SheetCellValue[][]
): Promise<void> => {
  const requiredRows = rows.length + 1;
  if (sheet.rowCount < requiredRows) {
    await sheet.resize({
      rowCount: requiredRows,
      columnCount: Math.max(sheet.columnCount, RESULT_COLUMN_COUNT),
    });
  }

  await sheet.clear(`A2:L${sheet.rowCount}`);
  if (rows.length === 0) return;

  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: requiredRows,
    startColumnIndex: 0,
    endColumnIndex: RESULT_COLUMN_COUNT,
  });

  rows.forEach((row, rowOffset) => {
    row.forEach((value, columnIndex) => {
      sheet.getCell(rowOffset + 1, columnIndex).value = value;
    });
  });

  await sheet.saveUpdatedCells();
};

const verifyRows = async (
  sheet: GoogleSpreadsheetWorksheet,
  rows: SheetCellValue[][]
): Promise<void> => {
  if (rows.length === 0) return;

  sheet.resetLocalCache(true);
  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: rows.length + 1,
    startColumnIndex: 0,
    endColumnIndex: RESULT_COLUMN_COUNT,
  });

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < RESULT_COLUMN_COUNT; columnIndex += 1) {
      const expected = String(rows[rowIndex][columnIndex] ?? '');
      const actual = String(sheet.getCell(rowIndex + 1, columnIndex).value ?? '');
      if (actual !== expected) {
        throw new Error(
          `${sheet.title} 재조회 불일치: ${rowIndex + 2}행 ${columnIndex + 1}열 ` +
            `(기대=${expected}, 실제=${actual})`
        );
      }
    }
  }
};

export interface OrderedResultRewrite {
  rowCount: number;
  targetTab: string;
}

export const loadOrderedSourceKeywords = async (
  target: OrderedResultTarget
): Promise<KeywordInfo[]> => {
  const config = getOrderedResultConfig(target);
  const auth = getGoogleSheetAuth();
  const sourceDoc = await openSpreadsheet(config.sourceSheetId, auth);
  const sourceSheet = getWorksheetByTitle(sourceDoc, config.sourceTab);
  const sourceKeywords = await loadKeywordsFromWorksheet(
    sourceSheet,
    config.sourceSheetType
  );

  return sourceKeywords.map(({ keyword, company }) => ({ keyword, company }));
};

export const rewriteResultSheetRows = async (
  target: OrderedResultTarget,
  rows: SheetCellValue[][]
): Promise<OrderedResultRewrite> => {
  const config = getOrderedResultConfig(target);
  assertWritableSheetId(TEST_CONFIG.SHEET_ID, `${config.label} 순서 보존 반영`);
  const auth = getGoogleSheetAuth();
  const targetDoc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, auth);
  const targetSheet = getWorksheetByTitle(targetDoc, config.targetTab);

  await writeRows(targetSheet, rows);
  await verifyRows(targetSheet, rows);

  logger.success(
    `${config.label} 결과 반영 및 재조회 완료: ${rows.length}행`
  );

  return { rowCount: rows.length, targetTab: config.targetTab };
};

export const rewriteOrderedResultSheet = async (
  target: OrderedResultTarget,
  results: ExposureResult[],
  keywordLogicMap?: Map<string, boolean>,
  includedKeywords?: KeywordInfo[]
): Promise<OrderedResultRewrite> => {
  const sourceKeywords = await loadOrderedSourceKeywords(target);
  const orderedKeywords = includedKeywords
    ? selectIncludedKeywordsInSourceOrder(target, sourceKeywords, includedKeywords)
    : sourceKeywords;
  const rows = buildSheetRows(
    orderedKeywords,
    results,
    keywordLogicMap
  );

  return rewriteResultSheetRows(target, rows);
};
