import { RootKeyword } from '../../database';
import { ROOT_CONFIG } from '../../constants';
import {
  getGoogleSheetAuth,
  getWorksheetById,
  openSpreadsheet,
} from '../google-sheets/direct-exposure-sheet';

const STOP_KEYWORDS = ['자료 미전달', '지료 미전달', '미전달 리스트'];
const MAX_ROWS = 1000;
const MAX_COLUMNS = 26;

export interface RootKeywordSyncRow {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  keywordType: 'basic';
}

export interface RootKeywordSyncResult {
  deleted: number;
  inserted: number;
  source: 'google-sheets-direct';
}

const normalize = (value: unknown): string => String(value ?? '').trim();

const findHeaderIndex = (headers: readonly unknown[], matches: string[]): number =>
  headers.findIndex((header) => {
    const normalized = normalize(header).toLowerCase();
    return matches.some((match) => normalized.includes(match));
  });

const parseNumber = (value: unknown): number | undefined => {
  const parsed = Number.parseInt(normalize(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseRootKeywordRows = (
  rows: readonly (readonly unknown[])[]
): RootKeywordSyncRow[] => {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell)));
  if (headerIndex === -1) throw new Error('루트 원본 헤더를 찾을 수 없음');

  const headers = rows[headerIndex];
  const keywordColumn = findHeaderIndex(headers, ['키워드', 'keyword']);
  const companyColumn = findHeaderIndex(headers, ['업체명', '업체']);
  const visibilityColumn = findHeaderIndex(headers, ['노출여부', '공정위', '노출']);
  const topicColumn = findHeaderIndex(headers, ['인기주제']);
  const rankColumn = headers.findIndex((header) => {
    const normalized = normalize(header).toLowerCase();
    return normalized.includes('순위') && !normalized.includes('인기글');
  });
  const popularRankColumn = headers.findIndex((header) => {
    const normalized = normalize(header).toLowerCase();
    return normalized.includes('인기글') && normalized.includes('순위');
  });
  const imageMatchColumn = headers.findIndex((header) => {
    const normalized = normalize(header).toLowerCase();
    return normalized.includes('이미지') && normalized.includes('매칭');
  });
  const urlColumn = headers.findIndex((header) => {
    const normalized = normalize(header).toLowerCase();
    return normalized.includes('시트') && normalized.includes('링크');
  });

  if (keywordColumn === -1 || companyColumn === -1) {
    throw new Error('루트 원본 필수 컬럼(키워드, 업체명)을 찾을 수 없음');
  }

  const dataRows = rows.slice(headerIndex + 1);
  const stopIndex = dataRows.findIndex((row) => {
    const text = row.map(normalize).join(' ').toLowerCase();
    return STOP_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
  });
  const targetRows = stopIndex === -1 ? dataRows : dataRows.slice(0, stopIndex);
  let currentCompany = '';

  return targetRows.flatMap((row) => {
    const keyword = normalize(row[keywordColumn]);
    if (!keyword) return [];

    const nextCompany = normalize(row[companyColumn]);
    if (nextCompany) currentCompany = nextCompany;
    if (!currentCompany) return [];

    const suffix = `(${currentCompany})`;
    const formattedKeyword = keyword.endsWith(suffix) ? keyword : `${keyword}${suffix}`;

    return [{
      company: currentCompany,
      keyword: formattedKeyword,
      visibility:
        visibilityColumn !== -1 && normalize(row[visibilityColumn]).toLowerCase() === 'o',
      popularTopic: topicColumn === -1 ? '' : normalize(row[topicColumn]),
      url: urlColumn === -1 ? '' : normalize(row[urlColumn]),
      rank: rankColumn === -1 ? undefined : parseNumber(row[rankColumn]),
      rankWithCafe:
        popularRankColumn === -1 ? undefined : parseNumber(row[popularRankColumn]),
      isUpdateRequired:
        imageMatchColumn === -1
          ? undefined
          : normalize(row[imageMatchColumn]).toLowerCase() === 'o',
      keywordType: 'basic' as const,
    }];
  });
};

export const isRootSourceSchemaMismatch = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('루트 원본 필수 컬럼') ||
    message.includes('루트 원본 헤더') ||
    message.includes('루트 원본에서 동기화할 키워드')
  );
};

const syncDirectlyFromGoogleSheets = async (): Promise<RootKeywordSyncResult> => {
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(ROOT_CONFIG.SHEET_ID, auth);
  const sheet = getWorksheetById(doc, ROOT_CONFIG.SHEET_GID);
  const rowCount = Math.min(sheet.rowCount, MAX_ROWS);
  const columnCount = Math.min(sheet.columnCount, MAX_COLUMNS);

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: rowCount,
    startColumnIndex: 0,
    endColumnIndex: columnCount,
  });

  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: columnCount }, (_, columnIndex) =>
      sheet.getCell(rowIndex, columnIndex).value
    )
  );
  const keywords = parseRootKeywordRows(rows);
  if (keywords.length === 0) {
    throw new Error('루트 원본에서 동기화할 키워드를 찾지 못함');
  }

  const deleteResult = await RootKeyword.deleteMany({});
  const insertResult = await RootKeyword.insertMany(
    keywords.map((keyword) => ({ ...keyword, lastChecked: new Date() }))
  );

  return {
    deleted: deleteResult.deletedCount,
    inserted: insertResult.length,
    source: 'google-sheets-direct',
  };
};

export const syncRootKeywordsFromSheet = async (): Promise<RootKeywordSyncResult> => {
  return syncDirectlyFromGoogleSheets();
};
