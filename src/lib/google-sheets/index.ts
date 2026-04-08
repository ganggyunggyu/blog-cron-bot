import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
} from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { CafeExposureRow } from '../cafe-exposure-check';
import { logger } from '../logger';

const CAFE_EXPOSURE_HEADERS = ['키워드', '노출여부', '순위', '카페명', '조회수', '작성일', '링크'];

const COLOR = {
  headerBg: { red: 0.24, green: 0.52, blue: 0.78 },
  headerText: { red: 1, green: 1, blue: 1 },
  exposedBg: { red: 0.85, green: 0.95, blue: 0.85 },
  failedBg: { red: 0.97, green: 0.87, blue: 0.87 },
  white: { red: 1, green: 1, blue: 1 },
};

const COLUMN_WIDTHS = [180, 70, 50, 140, 70, 100, 400];

const CENTER_COLUMNS = [1, 2, 4, 5];

const getAuth = (): JWT => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 또는 GOOGLE_PRIVATE_KEY 환경변수가 없음');
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const applyFormatting = async (
  sheet: GoogleSpreadsheetWorksheet,
  rows: CafeExposureRow[]
): Promise<void> => {
  const colCount = CAFE_EXPOSURE_HEADERS.length;
  const totalRows = rows.length + 1;
  const lastCol = String.fromCharCode(64 + colCount);

  await sheet.loadCells(`A1:${lastCol}${totalRows}`);

  // 헤더 스타일
  for (let col = 0; col < colCount; col++) {
    const cell = sheet.getCell(0, col);
    cell.backgroundColor = COLOR.headerBg;
    cell.textFormat = {
      bold: true,
      fontSize: 10,
      foregroundColor: COLOR.headerText,
    };
    cell.horizontalAlignment = 'CENTER';
  }

  // 데이터 행 스타일
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const sheetRow = rowIdx + 1;

    const isExposed = row.exposureStatus === '노출';
    const isFailed = row.exposureStatus === '확인실패';

    for (let col = 0; col < colCount; col++) {
      const cell = sheet.getCell(sheetRow, col);

      if (isExposed) {
        cell.backgroundColor = COLOR.exposedBg;
      } else if (isFailed) {
        cell.backgroundColor = COLOR.failedBg;
      } else {
        cell.backgroundColor = COLOR.white;
      }

      if (CENTER_COLUMNS.includes(col)) {
        cell.horizontalAlignment = 'CENTER';
      }
    }
  }

  await sheet.saveUpdatedCells();

  // 헤더 고정
  await sheet.updateGridProperties({ frozenRowCount: 1 });

  // 컬럼 너비
  for (let col = 0; col < colCount; col++) {
    await sheet.updateDimensionProperties(
      'COLUMNS',
      { pixelSize: COLUMN_WIDTHS[col] },
      { startIndex: col, endIndex: col + 1 }
    );
  }
};

export const exportCafeExposureToSheet = async (
  rows: CafeExposureRow[],
  sheetId: string,
  sheetName: string,
  sheetTabId?: number
): Promise<void> => {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();

  const { sheet } = await getOrCreateSheet(doc, sheetName, sheetTabId);

  await sheet.clear();

  if (sheet.columnCount < CAFE_EXPOSURE_HEADERS.length) {
    await sheet.resize({
      rowCount: sheet.rowCount,
      columnCount: CAFE_EXPOSURE_HEADERS.length,
    });
  }

  await sheet.setHeaderRow(CAFE_EXPOSURE_HEADERS);

  const sheetRows = rows.map((row) => ({
    '키워드': row.keyword,
    '노출여부': row.exposureStatus === '노출' ? 'o' : '',
    '순위': row.rank,
    '카페명': row.cafeName,
    '조회수': row.viewCount || '',
    '작성일': row.writeDate || '',
    '링크': row.link,
  }));

  await sheet.addRows(sheetRows);

  await applyFormatting(sheet, rows);

  logger.success(`Google Sheets 내보내기 완료: "${sheetName}" (${rows.length}행)`);
};

export const appendCafeExposureToSheet = async (
  rows: CafeExposureRow[],
  sheetId: string,
  sheetName: string,
  sheetTabId?: number,
  separatorLabel?: string
): Promise<void> => {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();

  const { sheet, created } = await getOrCreateSheet(doc, sheetName, sheetTabId);

  if (sheet.columnCount < CAFE_EXPOSURE_HEADERS.length) {
    await sheet.resize({
      rowCount: sheet.rowCount,
      columnCount: CAFE_EXPOSURE_HEADERS.length,
    });
  }

  if (created || sheet.headerValues.length === 0) {
    await sheet.setHeaderRow(CAFE_EXPOSURE_HEADERS);
  }

  const label = separatorLabel || new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  await sheet.addRows([
    { '키워드': `── ${label} ──`, '노출여부': '', '순위': '', '카페명': '', '조회수': '', '작성일': '', '링크': '' },
  ]);

  const sheetRows = rows.map((row) => ({
    '키워드': row.keyword,
    '노출여부': row.exposureStatus === '노출' ? 'o' : '',
    '순위': row.rank,
    '카페명': row.cafeName,
    '조회수': row.viewCount || '',
    '작성일': row.writeDate || '',
    '링크': row.link,
  }));

  await sheet.addRows(sheetRows);

  logger.success(`Google Sheets 추가 내보내기 완료: "${sheetName}" (+${rows.length}행)`);
};

const getOrCreateSheet = async (
  doc: GoogleSpreadsheet,
  sheetName: string,
  sheetTabId?: number
): Promise<{
  created: boolean;
  sheet: GoogleSpreadsheetWorksheet;
}> => {
  if (typeof sheetTabId === 'number') {
    const existingSheetById = doc.sheetsById[sheetTabId];
    if (existingSheetById) {
      return {
        created: false,
        sheet: existingSheetById,
      };
    }
  }

  const existingSheet = doc.sheetsByTitle[sheetName];
  if (existingSheet) {
    return {
      created: false,
      sheet: existingSheet,
    };
  }

  const createdSheet = await doc.addSheet({
    title: sheetName,
    headerValues: CAFE_EXPOSURE_HEADERS,
  });
  logger.info(`Google Sheets 시트 생성 완료: "${sheetName}"`);

  return {
    created: true,
    sheet: createdSheet,
  };
};
