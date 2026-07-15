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
  postPublishedAt?: string;
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

const HEADER_ROW_SCAN_LIMIT = 10;

/**
 * 스캔한 상단 행들(각 행은 정규화된 셀 텍스트 배열) 중 targetHeader와 정확히 일치하는
 * 셀이 있는 첫 행의 인덱스를 반환. 못 찾으면 null.
 * 순수 함수라 실제 시트 없이도 테스트 가능 — I/O(loadHeaderRowAutoDetect)와 분리해둠.
 */
export const findHeaderRowIndex = (
  rows: readonly string[][],
  targetHeader: string
): number | null => {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (rows[rowIndex].some((value) => value === targetHeader)) {
      return rowIndex;
    }
  }

  return null;
};

const hasDuplicateHeader = (headers: readonly string[]): boolean => {
  const nonEmpty = headers.filter((header) => header.length > 0);
  return new Set(nonEmpty).size !== nonEmpty.length;
};

/**
 * 같은 이름이 반복되는 헤더 뒤쪽 항목에 접미사를 붙여 유일하게 만듦.
 * google-spreadsheet의 loadHeaderRow()는 중복 헤더를 발견하면 무조건 throw하는데,
 * 일부 실제 운영 시트(A/B열 둘 다 "키워드")는 의도된 구조라 시트 자체를 고칠 수 없음 —
 * 읽기 쪽에서만 우회.
 */
const dedupeHeaders = (headers: readonly string[]): string[] => {
  const seenCounts = new Map<string, number>();

  return headers.map((header) => {
    if (!header) {
      return header;
    }

    const count = seenCounts.get(header) ?? 0;
    seenCounts.set(header, count + 1);

    return count === 0 ? header : `${header}__dup${count}`;
  });
};

interface WorksheetWithPrivateHeaderState {
  _headerValues: string[];
  _headerRowIndex: number;
}

const loadHeaderRowAutoDetect = async (
  sheet: GoogleSpreadsheetWorksheet
): Promise<void> => {
  const scanRowCount = Math.min(HEADER_ROW_SCAN_LIMIT, sheet.rowCount || 1);

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: Math.max(scanRowCount, 1),
    startColumnIndex: 0,
    endColumnIndex: sheet.columnCount,
  });

  const scannedRows: string[][] = Array.from({ length: scanRowCount }, (_, rowIndex) =>
    Array.from({ length: sheet.columnCount }, (_, columnIndex) =>
      normalizeCell(sheet.getCell(rowIndex, columnIndex).value)
    )
  );

  const headerRowIndex = findHeaderRowIndex(scannedRows, '키워드');
  const targetRowIndex = headerRowIndex ?? 0;
  const rawHeaders = scannedRows[targetRowIndex] ?? [];

  if (hasDuplicateHeader(rawHeaders)) {
    const worksheetWithPrivateState = sheet as unknown as WorksheetWithPrivateHeaderState;
    worksheetWithPrivateState._headerValues = dedupeHeaders(rawHeaders);
    worksheetWithPrivateState._headerRowIndex = targetRowIndex + 1;
    return;
  }

  if (headerRowIndex !== null) {
    await sheet.loadHeaderRow(headerRowIndex + 1);
    return;
  }

  await sheet.loadHeaderRow();
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
  await loadHeaderRowAutoDetect(sheet);

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

/**
 * 키워드 텍스트 → 그 키워드를 가진 대상 시트 행들의 큐.
 * 결과 소스(CSV/DB)와 대상 시트의 행 순서가 어긋나 있을 수 있어서 '행' 번호로 위치
 * 매칭하면 엉뚱한 키워드에 값이 써짐 — 키워드 텍스트로 매칭해서 순서가 달라도 정확한
 * 행에 반영되도록 함. 동일 키워드가 여러 번 나오면 시트에 나온 순서 그대로 큐에서
 * 하나씩 소비(선입선출)해서 배정함.
 */
export const buildKeywordQueueMap = (
  keywords: DirectSheetKeywordDoc[]
): Map<string, DirectSheetKeywordDoc[]> => {
  const queueMap = new Map<string, DirectSheetKeywordDoc[]>();

  keywords.forEach((keyword) => {
    const normalized = normalizeCell(keyword.keyword);
    const queue = queueMap.get(normalized) ?? [];
    queue.push(keyword);
    queueMap.set(normalized, queue);
  });

  return queueMap;
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
    foundPage,
    postPublishedAt
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
      postPublishedAt,
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

  await loadHeaderRowAutoDetect(sheet);

  const headerMap = getHeaderIndexMap(sheet);
  const topicCol = getHeaderIndex(headerMap, ['인기주제']);
  const rankCol = getHeaderIndex(headerMap, ['순위']);
  const exposedCol = getHeaderIndex(headerMap, ['노출여부']);
  const viralCheckCol = getHeaderIndex(headerMap, ['바이럴체크', '바이럴 체크']);
  const popularRankCol = getHeaderIndex(headerMap, ['인기글순위', '인기글 순위']);
  const matchedTitleCol = getHeaderIndex(headerMap, ['이미지매칭', '이미지 매칭']);
  const linkCol = getHeaderIndex(headerMap, ['링크']);
  const publishedAtCol = getHeaderIndex(headerMap, ['발행일', '작성일']);
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
    publishedAtCol,
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
    setCellValue(
      sheet,
      rowIndex,
      publishedAtCol,
      visibility ? update?.postPublishedAt ?? '' : ''
    );
    setCellValue(sheet, rowIndex, logicCol, logicValue);
    setCellValue(sheet, rowIndex, rowCol, keyword.orderIndex);
  });

  await sheet.saveUpdatedCells();

  logger.success(`Google Sheets 직접 반영 완료: ${sheet.title} (${keywords.length}개)`);
};
