import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config();

type SourceTab = '패키지' | '일반건' | '도그마루';

interface TabPair {
  sourceTitle: SourceTab;
  outputTitle: string;
}

interface TabReport {
  outputTitle: string;
  scannedRows: number;
  changedRows: number;
  remainingVendorSuffixRows: number;
  samples: Array<{ before: string; after: string }>;
}

const SHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const TAB_PAIRS: TabPair[] = [
  { sourceTitle: '패키지', outputTitle: '패키지_더보기' },
  { sourceTitle: '일반건', outputTitle: '일반건_더보기' },
  { sourceTitle: '도그마루', outputTitle: '도그마루_더보기' },
];

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

const normalizeHeader = (value: unknown): string =>
  normalizeCell(value).replace(/\s+/g, '').toLowerCase();

const normalizeVendorTarget = (value: unknown): string => {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map((line) => normalizeCell(line))
    .filter(Boolean);

  return lines[0] ?? '';
};

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

const openSpreadsheet = async (): Promise<GoogleSpreadsheet> => {
  const doc = new GoogleSpreadsheet(SHEET_ID, getAuth());
  await doc.loadInfo();
  return doc;
};

const loadHeaderValues = async (sheet: GoogleSpreadsheetWorksheet): Promise<string[]> => {
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: 1,
    startColumnIndex: 0,
    endColumnIndex: Math.max(sheet.columnCount, 1),
  });

  return Array.from({ length: sheet.columnCount }, (_, columnIndex) =>
    normalizeCell(sheet.getCell(0, columnIndex).formattedValue ?? sheet.getCell(0, columnIndex).value)
  );
};

const getHeaderColumnIndex = (headers: string[], aliases: string[]): number | null => {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headers.findIndex((header) =>
    normalizedAliases.includes(normalizeHeader(header))
  );

  return index >= 0 ? index : null;
};

const getLoadedCellText = (
  sheet: GoogleSpreadsheetWorksheet,
  rowIndex: number,
  columnIndex: number | null
): string => {
  if (columnIndex === null) {
    return '';
  }

  const cell = sheet.getCell(rowIndex, columnIndex);
  return normalizeCell(cell.formattedValue ?? cell.value);
};

const buildVendorLabeledKeywordSet = async (
  sheet: GoogleSpreadsheetWorksheet
): Promise<Set<string>> => {
  const headers = await loadHeaderValues(sheet);
  const keywordColumnIndex = getHeaderColumnIndex(headers, ['키워드']);
  const companyColumnIndex = getHeaderColumnIndex(headers, ['업체명']);

  if (keywordColumnIndex === null || companyColumnIndex === null) {
    throw new Error(`${sheet.title} 탭의 키워드/업체명 헤더를 찾을 수 없음`);
  }

  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: sheet.rowCount,
    startColumnIndex: Math.min(keywordColumnIndex, companyColumnIndex),
    endColumnIndex: Math.max(keywordColumnIndex, companyColumnIndex) + 1,
  });

  const labeledKeywords = new Set<string>();

  for (let rowIndex = 1; rowIndex < sheet.rowCount; rowIndex += 1) {
    const keyword = getLoadedCellText(sheet, rowIndex, keywordColumnIndex);
    const vendorTarget = normalizeVendorTarget(
      getLoadedCellText(sheet, rowIndex, companyColumnIndex)
    );

    if (!keyword || !vendorTarget) {
      continue;
    }

    labeledKeywords.add(`${keyword}(${vendorTarget})`);
  }

  return labeledKeywords;
};

const stripOutputTab = async (
  outputSheet: GoogleSpreadsheetWorksheet,
  sourceLabeledKeywords: Set<string>
): Promise<TabReport> => {
  await outputSheet.loadCells({
    startRowIndex: 1,
    endRowIndex: outputSheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: 1,
  });

  let scannedRows = 0;
  let changedRows = 0;
  let remainingVendorSuffixRows = 0;
  const samples: TabReport['samples'] = [];

  for (let rowIndex = 1; rowIndex < outputSheet.rowCount; rowIndex += 1) {
    const cell = outputSheet.getCell(rowIndex, 0);
    const before = normalizeCell(cell.formattedValue ?? cell.value);

    if (!before) {
      continue;
    }

    scannedRows += 1;
    const match = before.match(/^(.+?)\s*[\(（]([^()（）]+)[\)）]\s*$/u);

    if (!match) {
      continue;
    }

    if (!sourceLabeledKeywords.has(before)) {
      remainingVendorSuffixRows += 1;
      continue;
    }

    const after = normalizeCell(match[1]);
    cell.value = after;
    changedRows += 1;

    if (samples.length < 8) {
      samples.push({ before, after });
    }
  }

  if (changedRows > 0) {
    await outputSheet.saveUpdatedCells();
  }

  return {
    outputTitle: outputSheet.title,
    scannedRows,
    changedRows,
    remainingVendorSuffixRows,
    samples,
  };
};

const main = async (): Promise<void> => {
  const doc = await openSpreadsheet();
  const reports: TabReport[] = [];

  for (const pair of TAB_PAIRS) {
    const sourceSheet = doc.sheetsByTitle[pair.sourceTitle];
    const outputSheet = doc.sheetsByTitle[pair.outputTitle];

    if (!sourceSheet || !outputSheet) {
      throw new Error(`${pair.sourceTitle}/${pair.outputTitle} 탭을 찾을 수 없음`);
    }

    const sourceLabeledKeywords = await buildVendorLabeledKeywordSet(sourceSheet);
    const report = await stripOutputTab(outputSheet, sourceLabeledKeywords);
    reports.push(report);
    console.log(
      `${report.outputTitle}: scanned=${report.scannedRows}, changed=${report.changedRows}, remaining_parenthesized=${report.remainingVendorSuffixRows}`
    );
  }

  const outputDir = path.resolve(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(
    outputDir,
    `old-logic-more-strip-vendors-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  await fs.writeFile(reportPath, `${JSON.stringify({ sheetId: SHEET_ID, reports }, null, 2)}\n`);
  console.log(`report=${reportPath}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
