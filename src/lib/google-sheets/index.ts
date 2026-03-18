import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
} from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { CafeExposureRow } from '../cafe-exposure-check';
import { logger } from '../logger';

const CAFE_EXPOSURE_HEADERS = ['키워드', '노출여부', '순위', '카페명', '링크'];

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

export const exportCafeExposureToSheet = async (
  rows: CafeExposureRow[],
  sheetId: string,
  sheetName: string
): Promise<void> => {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();

  const { sheet } = await getOrCreateSheet(doc, sheetName);

  await sheet.clear();

  await sheet.setHeaderRow(CAFE_EXPOSURE_HEADERS);

  const sheetRows = rows.map((row) => ({
    '키워드': row.keyword,
    '노출여부': row.exposureStatus === '노출' ? 'o' : '',
    '순위': row.rank,
    '카페명': row.cafeName,
    '링크': row.link,
  }));

  await sheet.addRows(sheetRows);

  logger.success(`Google Sheets 내보내기 완료: "${sheetName}" (${rows.length}행)`);
};

export const appendCafeExposureToSheet = async (
  rows: CafeExposureRow[],
  sheetId: string,
  sheetName: string,
  separatorLabel?: string
): Promise<void> => {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();

  const { sheet, created } = await getOrCreateSheet(doc, sheetName);

  if (created || sheet.headerValues.length === 0) {
    await sheet.setHeaderRow(CAFE_EXPOSURE_HEADERS);
  }

  const label = separatorLabel || new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  await sheet.addRows([
    { '키워드': `── ${label} ──`, '노출여부': '', '순위': '', '카페명': '', '링크': '' },
  ]);

  const sheetRows = rows.map((row) => ({
    '키워드': row.keyword,
    '노출여부': row.exposureStatus === '노출' ? 'o' : '',
    '순위': row.rank,
    '카페명': row.cafeName,
    '링크': row.link,
  }));

  await sheet.addRows(sheetRows);

  logger.success(`Google Sheets 추가 내보내기 완료: "${sheetName}" (+${rows.length}행)`);
};

const getOrCreateSheet = async (
  doc: GoogleSpreadsheet,
  sheetName: string
): Promise<{
  created: boolean;
  sheet: GoogleSpreadsheetWorksheet;
}> => {
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
