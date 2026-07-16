import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config();

const SOURCE_SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';
const SOURCE_GID = 126285763;
const TARGET_SHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const TARGET_GID = 1406050962;
const TARGET_TITLE = '카페노출체크';

const HEADERS = ['키워드', '노출여부', '순위', '카페블로그명', '링크'];

interface CafeExportRow {
  [key: string]: string;
  키워드: string;
  노출여부: string;
  순위: string;
  카페블로그명: string;
  링크: string;
}

const text = (value: unknown): string => String(value ?? '').trim();

const getAuth = (): JWT => {
  const email = text(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const key = text(process.env.GOOGLE_PRIVATE_KEY)
    .replace(/\\\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\+$/, '');

  if (!email || !key) {
    throw new Error('Google Sheets 서비스 계정 환경변수가 없음');
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const openSheet = async (
  spreadsheetId: string,
  gid: number
): Promise<GoogleSpreadsheetWorksheet> => {
  const doc = new GoogleSpreadsheet(spreadsheetId, getAuth());
  await doc.loadInfo();
  const sheet = doc.sheetsById[gid];
  if (!sheet) throw new Error(`gid=${gid} 시트를 찾지 못함`);
  return sheet;
};

const loadSourceRows = async (): Promise<CafeExportRow[]> => {
  const sheet = await openSheet(SOURCE_SHEET_ID, SOURCE_GID);
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: 21,
  });

  let markerRowIndex = -1;
  for (let rowIndex = 0; rowIndex < sheet.rowCount; rowIndex += 1) {
    if (/스케[줄쥴]/.test(text(sheet.getCell(rowIndex, 0).value))) {
      markerRowIndex = rowIndex;
      break;
    }
  }
  if (markerRowIndex < 0) throw new Error('A열 스케줄 제목을 찾지 못함');

  let lastScheduleRowIndex = markerRowIndex;
  for (let rowIndex = markerRowIndex + 1; rowIndex < sheet.rowCount; rowIndex += 1) {
    const keyword = text(sheet.getCell(rowIndex, 0).value);
    if (/스케[줄쥴]/.test(keyword)) break;
    if (keyword) lastScheduleRowIndex = rowIndex;
  }

  const rows: CafeExportRow[] = [];
  for (let rowIndex = markerRowIndex + 1; rowIndex <= lastScheduleRowIndex; rowIndex += 1) {
    const keyword = text(sheet.getCell(rowIndex, 0).value);

    rows.push({
      키워드: keyword,
      노출여부: text(sheet.getCell(rowIndex, 17).value),
      순위: text(sheet.getCell(rowIndex, 18).value),
      카페블로그명: text(sheet.getCell(rowIndex, 19).value),
      링크: text(sheet.getCell(rowIndex, 20).value),
    });
  }

  return rows;
};

const exportRows = async (rows: CafeExportRow[]): Promise<void> => {
  const sheet = await openSheet(TARGET_SHEET_ID, TARGET_GID);
  if (sheet.title !== TARGET_TITLE) {
    throw new Error(`예상 탭명 ${TARGET_TITLE}과 실제 탭명 ${sheet.title}이 다름`);
  }

  await sheet.clear();
  await sheet.resize({
    rowCount: Math.max(rows.length + 20, 1000),
    columnCount: HEADERS.length,
  });
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: rows.length + 1,
    startColumnIndex: 0,
    endColumnIndex: HEADERS.length,
  });

  HEADERS.forEach((header, columnIndex) => {
    sheet.getCell(0, columnIndex).value = header;
  });
  rows.forEach((row, rowOffset) => {
    HEADERS.forEach((header, columnIndex) => {
      sheet.getCell(rowOffset + 1, columnIndex).value = row[header] ?? '';
    });
  });
  await sheet.saveUpdatedCells();
};

const main = async (): Promise<void> => {
  const rows = await loadSourceRows();
  if (rows.length === 0) throw new Error('내보낼 스케줄 키워드가 없음');

  await exportRows(rows);

  const summary = {
    sourceSheetId: SOURCE_SHEET_ID,
    sourceGid: SOURCE_GID,
    targetSheetId: TARGET_SHEET_ID,
    targetGid: TARGET_GID,
    targetTitle: TARGET_TITLE,
    rows: rows.length,
    exposed: rows.filter((row) => row.노출여부 === 'o').length,
  };
  const outputPath = path.join(
    process.cwd(),
    'outputs',
    `cafe-schedule-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(outputPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ summary, outputPath }, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
