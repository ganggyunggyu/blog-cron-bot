import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
  GoogleSpreadsheetRow,
} from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { logger } from '../logger';
import { UpdateFunction, KeywordType } from '../keyword-processor/types';

type SheetRowValue = string | number | boolean | Date | null | undefined;
type SheetRowRecord = Record<string, SheetRowValue>;

export interface DirectSheetKeywordDoc {
  _id: string;
  keyword: string;
  company: string;
  sheetType: string;
  sheetRowNumber: number;
  orderIndex: number;
  isUpdateRequired: boolean;
}

export interface DirectSheetUpdate {
  visibility: boolean;
  popularTopic: string;
  url: string;
  keywordType: KeywordType;
  restaurantName?: string;
  matchedTitle?: string;
  rank?: number;
  postVendorName?: string;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
}

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

const normalizeHeader = (value: unknown): string =>
  normalizeCell(value).replace(/\s+/g, '').toLowerCase();

const parseBooleanCell = (value: unknown): boolean => {
  const normalized = normalizeCell(value).toLowerCase();
  return ['o', '1', 'true', 'y', 'yes', '신규'].includes(normalized);
};

const getGoogleServiceAccountEmail = (): string => {
  const value = normalizeCell(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);

  if (!value) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 환경변수가 없음');
  }

  return value;
};

const getGooglePrivateKey = (): string => {
  const value = normalizeCell(process.env.GOOGLE_PRIVATE_KEY).replace(
    /\\n/g,
    '\n'
  );

  if (!value) {
    throw new Error('GOOGLE_PRIVATE_KEY 환경변수가 없음');
  }

  return value;
};

export const getGoogleSheetAuth = (): JWT =>
  new JWT({
    email: getGoogleServiceAccountEmail(),
    key: getGooglePrivateKey(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

export const openSpreadsheet = async (
  sheetId: string,
  auth: JWT
): Promise<GoogleSpreadsheet> => {
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  return doc;
};

export const getWorksheetByTitle = (
  doc: GoogleSpreadsheet,
  title: string
): GoogleSpreadsheetWorksheet => {
  const sheet = doc.sheetsByTitle[title];

  if (!sheet) {
    throw new Error(`"${title}" 탭을 찾을 수 없음`);
  }

  return sheet;
};

const getHeaderIndexMap = (sheet: GoogleSpreadsheetWorksheet): Map<string, number> => {
  const headerMap = new Map<string, number>();

  sheet.headerValues.forEach((header, index) => {
    const normalized = normalizeHeader(header);

    if (!normalized || headerMap.has(normalized)) {
      return;
    }

    headerMap.set(normalized, index);
  });

  return headerMap;
};

const getHeaderIndex = (
  headerMap: Map<string, number>,
  aliases: string[]
): number | null => {
  for (const alias of aliases) {
    const normalized = normalizeHeader(alias);

    if (headerMap.has(normalized)) {
      return headerMap.get(normalized) ?? null;
    }
  }

  return null;
};

const getRowValue = (
  row: GoogleSpreadsheetRow<SheetRowRecord>,
  key: string
): string => normalizeCell(row.get(key));

const getSheetRowNumber = (
  row: GoogleSpreadsheetRow<SheetRowRecord>,
  fallbackRowNumber: number
): number => {
  const rowNumber = Reflect.get(row, 'rowNumber');

  if (typeof rowNumber === 'number' && Number.isFinite(rowNumber)) {
    return rowNumber;
  }

  return fallbackRowNumber;
};

export const loadKeywordsFromWorksheet = async (
  sheet: GoogleSpreadsheetWorksheet,
  sheetType: string
): Promise<DirectSheetKeywordDoc[]> => {
  await sheet.loadHeaderRow();

  const rows = await sheet.getRows<SheetRowRecord>();
  const keywords = rows.flatMap((row, index) => {
    const keyword = getRowValue(row, '키워드');

    if (!keyword) {
      return [];
    }

    const sheetRowNumber = getSheetRowNumber(row, index + 2);
    const company = getRowValue(row, '업체명');
    const isUpdateRequired = parseBooleanCell(row.get('바이럴 체크'));

    return [
      {
        _id: `${sheetType}:${sheetRowNumber}`,
        keyword,
        company,
        sheetType,
        sheetRowNumber,
        orderIndex: index,
        isUpdateRequired,
      },
    ];
  });

  return keywords;
};

export const createDirectUpdateCollector = (): {
  updates: Map<string, DirectSheetUpdate>;
  updateFunction: UpdateFunction;
} => {
  const updates = new Map<string, DirectSheetUpdate>();

  const updateFunction: UpdateFunction = async (
    keywordId,
    visibility,
    popularTopic,
    url,
    keywordType,
    restaurantName,
    matchedTitle,
    rank,
    postVendorName,
    rankWithCafe,
    isUpdateRequired,
    isNewLogic,
    foundPage
  ) => {
    updates.set(keywordId, {
      visibility,
      popularTopic,
      url,
      keywordType,
      restaurantName,
      matchedTitle,
      rank,
      postVendorName,
      rankWithCafe,
      isUpdateRequired,
      isNewLogic,
      foundPage,
    });
  };

  return {
    updates,
    updateFunction,
  };
};

const getCellWriteValue = (value?: number | string | boolean): string | number => {
  if (typeof value === 'number') {
    return value > 0 ? value : '';
  }

  if (typeof value === 'boolean') {
    return value ? 'o' : '';
  }

  return value ?? '';
};

const setCellValue = (
  sheet: GoogleSpreadsheetWorksheet,
  rowIndex: number,
  colIndex: number | null,
  value: string | number
): void => {
  if (colIndex === null) {
    return;
  }

  sheet.getCell(rowIndex, colIndex).value = value;
};

export const writeResultsToWorksheet = async (
  sheet: GoogleSpreadsheetWorksheet,
  keywords: DirectSheetKeywordDoc[],
  updates: Map<string, DirectSheetUpdate>
): Promise<void> => {
  if (keywords.length === 0) {
    return;
  }

  await sheet.loadHeaderRow();

  const headerMap = getHeaderIndexMap(sheet);
  const topicCol = getHeaderIndex(headerMap, ['인기주제']);
  const rankCol = getHeaderIndex(headerMap, ['순위']);
  const exposedCol = getHeaderIndex(headerMap, ['노출여부']);
  const viralCheckCol = getHeaderIndex(headerMap, ['바이럴체크', '바이럴 체크']);
  const popularRankCol = getHeaderIndex(headerMap, ['인기글순위', '인기글 순위']);
  const matchedTitleCol = getHeaderIndex(headerMap, ['이미지매칭', '이미지 매칭']);
  const linkCol = getHeaderIndex(headerMap, ['링크']);
  const logicCol = getHeaderIndex(headerMap, ['변경', '로직', '신규로직']);
  const rowCol = getHeaderIndex(headerMap, ['행']);

  const columnIndexes = [
    topicCol,
    rankCol,
    exposedCol,
    viralCheckCol,
    popularRankCol,
    matchedTitleCol,
    linkCol,
    logicCol,
    rowCol,
  ].filter((value): value is number => value !== null);

  const maxColumnIndex = Math.max(...columnIndexes, 0);
  const maxRowNumber = Math.max(...keywords.map(({ sheetRowNumber }) => sheetRowNumber));

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: maxRowNumber,
    startColumnIndex: 0,
    endColumnIndex: maxColumnIndex + 1,
  });

  keywords.forEach((keyword) => {
    const rowIndex = keyword.sheetRowNumber - 1;
    const update = updates.get(keyword._id);
    const visibility = update?.visibility ?? false;
    const logicValue = update?.isNewLogic === true ? 'o' : '';
    const viralCheckValue = update?.isUpdateRequired === true ? 'o' : '';

    setCellValue(sheet, rowIndex, topicCol, visibility ? update?.popularTopic ?? '' : '');
    setCellValue(sheet, rowIndex, rankCol, visibility ? getCellWriteValue(update?.rank) : '');
    setCellValue(sheet, rowIndex, exposedCol, visibility ? 'o' : '');
    setCellValue(sheet, rowIndex, viralCheckCol, viralCheckValue);
    setCellValue(
      sheet,
      rowIndex,
      popularRankCol,
      visibility ? getCellWriteValue(update?.rankWithCafe) : ''
    );
    setCellValue(
      sheet,
      rowIndex,
      matchedTitleCol,
      visibility ? update?.matchedTitle ?? '' : ''
    );
    setCellValue(sheet, rowIndex, linkCol, visibility ? update?.url ?? '' : '');
    setCellValue(sheet, rowIndex, logicCol, logicValue);
    setCellValue(sheet, rowIndex, rowCol, keyword.orderIndex);
  });

  await sheet.saveUpdatedCells();

  logger.success(`Google Sheets 직접 반영 완료: ${sheet.title} (${keywords.length}개)`);
};
