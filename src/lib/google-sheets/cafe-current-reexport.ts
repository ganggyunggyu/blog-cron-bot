import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { TEST_CONFIG } from '../../constants';
import {
  buildCafeScheduleExportRows,
  type CafeScheduleCheckRow,
  extractLatestCafeScheduleSourceRows,
} from '../cafe-schedule-export';
import type { SheetCellValue } from '../csv-output';
import { logger } from '../logger';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  openSpreadsheet,
} from './direct-exposure-sheet';
import { assertWritableSheetId } from './write-target-guard';

const SOURCE_SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';
const SOURCE_SHEET_NAME = '카페 발행스케줄';
const TARGET_SHEET_ID = TEST_CONFIG.SHEET_ID;
const TARGET_SHEET_NAME = '카페노출체크';
const HEADERS = ['키워드', '노출여부', '순위', '카페블로그명', '링크'];

const loadValues = async (
  sheet: GoogleSpreadsheetWorksheet,
  columnCount: number
): Promise<unknown[][]> => {
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: columnCount,
  });
  return Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    Array.from({ length: columnCount }, (_, columnIndex) =>
      sheet.getCell(rowIndex, columnIndex).value
    )
  );
};

export const buildCafeCurrentRows = (
  sourceValues: unknown[][],
  targetValues: unknown[][]
): SheetCellValue[][] => {
  const sourceRows = extractLatestCafeScheduleSourceRows(sourceValues);
  const checkedRows: CafeScheduleCheckRow[] = targetValues
    .slice(1)
    .flatMap((row, index) => {
      const keyword = String(row[0] ?? '');
      if (!keyword.trim()) return [];
      return [{
        row: index + 2,
        keyword,
        exposureStatus: String(row[1] ?? '').trim().toLowerCase() === 'o'
          ? '노출' as const
          : '미노출' as const,
        rank: String(row[2] ?? ''),
        name: String(row[3] ?? ''),
        links: String(row[4] ?? ''),
      }];
    });
  const rows = buildCafeScheduleExportRows(sourceRows, checkedRows, false);
  return rows.map((row) => HEADERS.map((header) => row[header] ?? ''));
};

const writeRows = async (
  sheet: GoogleSpreadsheetWorksheet,
  rows: SheetCellValue[][]
): Promise<void> => {
  const values = [HEADERS, ...rows];
  if (sheet.rowCount < values.length) {
    await sheet.resize({
      rowCount: values.length,
      columnCount: Math.max(sheet.columnCount, HEADERS.length),
    });
  }

  await sheet.clear(`A1:E${sheet.rowCount}`);
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: values.length,
    startColumnIndex: 0,
    endColumnIndex: HEADERS.length,
  });
  values.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      sheet.getCell(rowIndex, columnIndex).value = value;
    });
  });
  await sheet.saveUpdatedCells();

  sheet.resetLocalCache(true);
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: values.length,
    startColumnIndex: 0,
    endColumnIndex: HEADERS.length,
  });
  values.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const actual = String(sheet.getCell(rowIndex, columnIndex).value ?? '');
      if (actual !== String(value ?? '')) {
        throw new Error(
          `${TARGET_SHEET_NAME} 재조회 불일치: ${rowIndex + 1}행 ${columnIndex + 1}열`
        );
      }
    });
  });
};

export const reexportCurrentCafeResults = async (): Promise<number> => {
  assertWritableSheetId(TARGET_SHEET_ID, '카페 결과 재내보내기');
  const auth = getGoogleSheetAuth();
  const [sourceDoc, targetDoc] = await Promise.all([
    openSpreadsheet(SOURCE_SHEET_ID, auth),
    openSpreadsheet(TARGET_SHEET_ID, auth),
  ]);
  const sourceSheet = getWorksheetByTitle(sourceDoc, SOURCE_SHEET_NAME);
  const targetSheet = getWorksheetByTitle(targetDoc, TARGET_SHEET_NAME);
  const [sourceValues, targetValues] = await Promise.all([
    loadValues(sourceSheet, 1),
    loadValues(targetSheet, HEADERS.length),
  ]);
  const rows = buildCafeCurrentRows(sourceValues, targetValues);

  await writeRows(targetSheet, rows);
  logger.success(`카페 원본 순서 반영 및 재조회 완료: ${rows.length}행`);
  return rows.length;
};
