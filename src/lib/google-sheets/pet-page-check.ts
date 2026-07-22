import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { EXPOSURE_SHEET_LOCATIONS, TEST_CONFIG } from '../../constants';
import type { SheetCellValue } from '../csv-output';
import { logger } from '../logger';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  loadKeywordsFromWorksheet,
  openSpreadsheet,
} from './direct-exposure-sheet';
import { assertWritableSheetId } from './write-target-guard';

export const PET_SOURCE_SHEET_ID =
  EXPOSURE_SHEET_LOCATIONS.애견.sheetId;
export const PET_SOURCE_SHEET_NAME = EXPOSURE_SHEET_LOCATIONS.애견.tabTitle;
export const PET_RESULT_SHEET_ID = TEST_CONFIG.SHEET_ID;
export const PET_RESULT_SHEET_NAME = '애견(전체블로그)';

const PET_COLUMN_COUNT = 7;

export interface PetResultInput {
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  rank?: number;
  rankWithCafe?: number;
  isNewLogic?: boolean;
}

const normalizeKeyword = (value: unknown): string => String(value ?? '').trim();

const createResultQueues = (
  results: PetResultInput[]
): Map<string, PetResultInput[]> => {
  const queues = new Map<string, PetResultInput[]>();
  results.forEach((result) => {
    const key = normalizeKeyword(result.keyword);
    const queue = queues.get(key) ?? [];
    queue.push(result);
    queues.set(key, queue);
  });
  return queues;
};

export const buildPetResultRows = (
  sourceKeywords: string[],
  results: PetResultInput[]
): SheetCellValue[][] => {
  if (sourceKeywords.length !== results.length) {
    throw new Error(
      `애견 원본과 결과 키워드 수가 다름: ${sourceKeywords.length}/${results.length}`
    );
  }

  const queues = createResultQueues(results);
  const rows = sourceKeywords.map((sourceKeyword) => {
    const result = queues.get(normalizeKeyword(sourceKeyword))?.shift();
    if (!result) {
      throw new Error(`애견 원본 결과 매칭 실패: ${sourceKeyword}`);
    }

    const visible = result.visibility === true;
    return [
      sourceKeyword,
      visible ? result.popularTopic : '',
      visible ? result.rank ?? '' : '',
      visible ? 'o' : '',
      visible ? result.rankWithCafe ?? '' : '',
      visible ? result.url : '',
      result.isNewLogic ? 'o' : '',
    ];
  });

  const unmatchedCount = Array.from(queues.values()).reduce(
    (count, queue) => count + queue.length,
    0
  );
  if (unmatchedCount > 0) {
    throw new Error(`애견 결과에 원본 미매칭 행 ${unmatchedCount}개가 남음`);
  }

  return rows;
};

const loadSourceKeywords = async (): Promise<string[]> => {
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(PET_SOURCE_SHEET_ID, auth);
  const sheet = getWorksheetByTitle(doc, PET_SOURCE_SHEET_NAME);
  const keywords = await loadKeywordsFromWorksheet(sheet, 'pet');
  return keywords.map(({ keyword }) => keyword);
};

const writeRows = async (
  sheet: GoogleSpreadsheetWorksheet,
  rows: SheetCellValue[][]
): Promise<void> => {
  const requiredRows = rows.length + 1;
  if (sheet.rowCount < requiredRows) {
    await sheet.resize({
      rowCount: requiredRows,
      columnCount: Math.max(sheet.columnCount, PET_COLUMN_COUNT),
    });
  }

  await sheet.clear(`A2:G${sheet.rowCount}`);
  if (rows.length === 0) return;

  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: requiredRows,
    startColumnIndex: 0,
    endColumnIndex: PET_COLUMN_COUNT,
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
  sheet.resetLocalCache(true);
  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: rows.length + 1,
    startColumnIndex: 0,
    endColumnIndex: PET_COLUMN_COUNT,
  });

  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const expected = String(value ?? '');
      const actual = String(sheet.getCell(rowIndex + 1, columnIndex).value ?? '');
      if (actual !== expected) {
        throw new Error(
          `${PET_RESULT_SHEET_NAME} 재조회 불일치: ${rowIndex + 2}행 ` +
            `${columnIndex + 1}열 (기대=${expected}, 실제=${actual})`
        );
      }
    });
  });
};

export const writePetResultsToSheet = async (
  results: PetResultInput[]
): Promise<void> => {
  assertWritableSheetId(PET_RESULT_SHEET_ID, '애견 결과 반영');
  const sourceKeywords = await loadSourceKeywords();
  const rows = buildPetResultRows(sourceKeywords, results);
  const auth = getGoogleSheetAuth();
  const targetDoc = await openSpreadsheet(PET_RESULT_SHEET_ID, auth);
  const targetSheet = getWorksheetByTitle(targetDoc, PET_RESULT_SHEET_NAME);

  await writeRows(targetSheet, rows);
  await verifyRows(targetSheet, rows);
  logger.success(`애견 원본 순서 반영 및 재조회 완료: ${rows.length}행`);
};
