import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config();

const SHEET_ID = '1K3in6YXzn3yL4sZHlU-LrcnBAvtT4J-LYPBa6vvS4OE';
const TSV_DIR = process.env.TSV_DIR || 'work/mar-jun-all-with-rank-tsv-20260629';
const SHEET_NAMES = ['제이제이', '철인삼남매', '사랑채마켓', '호이호이'];
const HEADER_FILL = { red: 0.12, green: 0.31, blue: 0.47 };
const HEADER_TEXT = { red: 1, green: 1, blue: 1 };
const COLUMN_WIDTHS = [360, 180, 150, 110, 130, 90];

type RowRecord = Record<string, string | number>;

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

const getAuth = (): JWT => {
  const email = normalizeCell(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const key = normalizeCell(process.env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 또는 GOOGLE_PRIVATE_KEY 환경변수가 없음');
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const parseTsv = async (filePath: string): Promise<{ headers: string[]; rows: RowRecord[] }> => {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  const headers = (lines.shift() || '').split('\t');
  const rows = lines.map((line) => {
    const cells = line.split('\t');
    return headers.reduce<RowRecord>((record, header, index) => {
      const value = cells[index] || '';
      record[header] = /^\d+$/.test(value) ? Number(value) : value;
      return record;
    }, {});
  });

  return { headers, rows };
};

const getSheet = (doc: GoogleSpreadsheet, title: string): GoogleSpreadsheetWorksheet => {
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    throw new Error(`${title} 탭을 찾을 수 없음`);
  }
  return sheet;
};

const applyFormat = async (
  sheet: GoogleSpreadsheetWorksheet,
  headers: string[],
  rowCount: number
): Promise<void> => {
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: Math.max(rowCount + 1, 1),
    startColumnIndex: 0,
    endColumnIndex: headers.length,
  });

  for (let col = 0; col < headers.length; col += 1) {
    const cell = sheet.getCell(0, col);
    cell.backgroundColor = HEADER_FILL;
    cell.textFormat = {
      bold: true,
      foregroundColor: HEADER_TEXT,
      fontSize: 10,
    };
    cell.horizontalAlignment = 'CENTER';
  }

  for (let row = 1; row <= rowCount; row += 1) {
    for (let col = 3; col < headers.length; col += 1) {
      sheet.getCell(row, col).horizontalAlignment = 'CENTER';
    }
  }

  await sheet.saveUpdatedCells();
  await sheet.updateGridProperties({ frozenRowCount: 1 });

  for (let col = 0; col < headers.length; col += 1) {
    await sheet.updateDimensionProperties(
      'COLUMNS',
      { pixelSize: COLUMN_WIDTHS[col] || 120 },
      { startIndex: col, endIndex: col + 1 }
    );
  }
};

const updateSheet = async (
  doc: GoogleSpreadsheet,
  sheetName: string
): Promise<{ sheetName: string; rows: number }> => {
  const sheet = getSheet(doc, sheetName);
  const { headers, rows } = await parseTsv(path.join(TSV_DIR, `${sheetName}.tsv`));

  await sheet.resize({ rowCount: Math.max(rows.length + 20, 1000), columnCount: 26 });
  await sheet.clear();
  await sheet.setHeaderRow(headers);
  if (rows.length > 0) {
    await sheet.addRows(rows);
  }
  await applyFormat(sheet, headers, rows.length);

  return { sheetName, rows: rows.length };
};

const main = async (): Promise<void> => {
  const doc = new GoogleSpreadsheet(SHEET_ID, getAuth());
  await doc.loadInfo();

  const summaries = [];
  for (const sheetName of SHEET_NAMES) {
    summaries.push(await updateSheet(doc, sheetName));
  }

  console.log(JSON.stringify({ sheetId: SHEET_ID, summaries }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
