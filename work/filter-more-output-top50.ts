import * as dotenv from 'dotenv';
import { TEST_CONFIG } from '../src/constants';
import {
  getGoogleSheetAuth,
  openSpreadsheet,
} from '../src/lib/google-sheets/direct-exposure-sheet';

dotenv.config();

const HEADERS = [
  '키워드',
  '블로그아이디',
  '순위',
  '링크',
  '작성일자',
  '상위글1작성일자',
  '상위글2작성일자',
  '상위글3작성일자',
  '상태',
];

const TARGET_TABS = [
  '패키지_더보기',
  '일반건_더보기',
  '도그마루_더보기',
  '루트_더보기',
];

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

type Row = string[];

interface Summary {
  tab: string;
  beforeRows: number;
  afterRows: number;
  exposedRows: number;
  nonExposedRows: number;
  maxRank: number;
  convertedToNonExposed: number;
}

const parseRank = (value: string): number | null => {
  const normalized = normalizeCell(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const readRows = async (sheet: any): Promise<Row[]> => {
  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: HEADERS.length,
  });

  const rows: Row[] = [];
  for (let rowIndex = 1; rowIndex < sheet.rowCount; rowIndex += 1) {
    const row = HEADERS.map((_, columnIndex) =>
      normalizeCell(
        sheet.getCell(rowIndex, columnIndex).formattedValue ??
          sheet.getCell(rowIndex, columnIndex).value
      )
    );

    if (row.some(Boolean)) {
      rows.push(row);
    }
  }

  return rows;
};

const groupRows = (rows: Row[]): Row[][] => {
  const groups: Row[][] = [];
  let current: Row[] = [];
  let currentKeyword = '';

  for (const row of rows) {
    const keyword = normalizeCell(row[0]);
    if (keyword && keyword !== currentKeyword) {
      if (current.length > 0) groups.push(current);
      current = [];
      currentKeyword = keyword;
    }

    if (!keyword && currentKeyword) {
      row[0] = currentKeyword;
    }

    current.push(row);
  }

  if (current.length > 0) groups.push(current);
  return groups;
};

const filterGroupTop50 = (group: Row[]): { rows: Row[]; converted: boolean } => {
  const first = group[0];
  const keyword = normalizeCell(first[0]);
  const topDates = [first[5] ?? '', first[6] ?? '', first[7] ?? ''];
  const exposedWithin50 = group.filter((row) => {
    const rank = parseRank(row[2]);
    return row[8] === '노출' && rank !== null && rank <= 50;
  });

  if (exposedWithin50.length > 0) {
    return {
      converted: false,
      rows: exposedWithin50.map((row, index) => [
        keyword,
        row[1] ?? '',
        row[2] ?? '',
        row[3] ?? '',
        row[4] ?? '',
        index === 0 ? topDates[0] : '',
        index === 0 ? topDates[1] : '',
        index === 0 ? topDates[2] : '',
        '노출',
      ]),
    };
  }

  const existingNonExposure = group.find((row) => row[8] && row[8] !== '노출');
  const status =
    existingNonExposure?.[8]?.startsWith('오류') || existingNonExposure?.[8] === '미노출'
      ? existingNonExposure[8]
      : '미노출';

  return {
    converted: group.some((row) => row[8] === '노출'),
    rows: [[keyword, '', '', '', '', topDates[0], topDates[1], topDates[2], status]],
  };
};

const clearAndWriteRows = async (sheet: any, rows: Row[]): Promise<void> => {
  const neededRows = rows.length + 1;
  if (sheet.rowCount < neededRows || sheet.columnCount < HEADERS.length) {
    await sheet.resize({
      rowCount: Math.max(sheet.rowCount, neededRows),
      columnCount: Math.max(sheet.columnCount, HEADERS.length),
    });
  }

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: HEADERS.length,
  });

  for (let rowIndex = 0; rowIndex < sheet.rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < HEADERS.length; columnIndex += 1) {
      sheet.getCell(rowIndex, columnIndex).value = '';
    }
  }

  HEADERS.forEach((header, columnIndex) => {
    sheet.getCell(0, columnIndex).value = header;
  });

  rows.forEach((row, rowOffset) => {
    row.forEach((value, columnIndex) => {
      sheet.getCell(rowOffset + 1, columnIndex).value = value;
    });
  });

  await sheet.saveUpdatedCells();
};

const main = async (): Promise<void> => {
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, auth);
  const summaries: Summary[] = [];

  for (const tab of TARGET_TABS) {
    const sheet = doc.sheetsByTitle[tab];
    if (!sheet) throw new Error(`${tab} 탭을 찾을 수 없음`);

    const beforeRows = await readRows(sheet);
    const filteredGroups = groupRows(beforeRows).map(filterGroupTop50);
    const afterRows = filteredGroups.flatMap((group) => group.rows);
    await clearAndWriteRows(sheet, afterRows);

    const ranks = afterRows
      .filter((row) => row[8] === '노출')
      .map((row) => parseRank(row[2]) ?? 0);
    summaries.push({
      tab,
      beforeRows: beforeRows.length,
      afterRows: afterRows.length,
      exposedRows: afterRows.filter((row) => row[8] === '노출').length,
      nonExposedRows: afterRows.filter((row) => row[8] !== '노출').length,
      maxRank: ranks.length > 0 ? Math.max(...ranks) : 0,
      convertedToNonExposed: filteredGroups.filter((group) => group.converted).length,
    });
  }

  console.log(JSON.stringify(summaries, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
