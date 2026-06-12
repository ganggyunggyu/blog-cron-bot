import * as dotenv from 'dotenv';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { ROOT_CONFIG } from '../constants';
import { sendDoorayMessage } from '../lib/dooray';
import { logger } from '../lib/logger';

dotenv.config();

interface CliOptions {
  date: Date;
  dryRun: boolean;
  limit: number;
  companyLimit: number;
  concurrency: number;
  checkCumulative: boolean;
  notify: boolean;
  exposedOnly: boolean;
}

interface ProgramRootRow {
  rowNumber: number;
  company: string;
  keyword: string;
  baseKeyword: string;
  isExposed: boolean;
  link: string;
}

interface MonthlyRootRow {
  rowNumber: number;
  company: string;
  keyword: string;
  sheetId: string;
  gid: number | null;
}

interface IndividualWritePlan {
  spreadsheetId: string;
  company: string;
  keyword: string;
  sourceRowNumber: number;
  monthlyRowNumber: number;
  spreadsheetTitle: string;
  sheetTitle: string;
  targetColumnNumber: number;
  targetRowNumber: number;
  dateColumnLabel: string;
  shouldCreateDateColumn: boolean;
  currentValue: string;
  nextValue: string;
  cumulativeColumnNumber: number | null;
  currentCumulativeValue: string;
  nextCumulativeValue: string;
  nextCumulativeFormula: string;
  extensionColumnNumber: number | null;
  extensionValue: string;
  nextExtensionValue: string;
  cumulativeReason: string;
  todayCumulativeNumber: number | null;
  terminationNotice: boolean;
  extensionReviewNotice: boolean;
  extensionProgressNotice: boolean;
}

interface IndividualSkip {
  company: string;
  keyword: string;
  reason: string;
}

interface MatchedPair {
  programRow: ProgramRootRow;
  monthlyRow: MonthlyRootRow;
  duplicateCount: number;
}

interface SheetMatchedPairGroup {
  sheetId: string;
  gid: number | null;
  pairs: MatchedPair[];
}

interface IndividualSheetSnapshot {
  headers: string[];
  rows: string[][];
}

interface DateParts {
  month: number;
  day: number;
}

interface DateColumnResolution {
  columnIndex: number;
  label: string;
  shouldCreate: boolean;
}

interface CumulativeCalculationResult {
  value: string;
  formula: string;
  nextExtensionValue: string;
  reason: string;
  todayCumulativeNumber: number | null;
  terminationNotice: boolean;
  extensionReviewNotice: boolean;
  extensionProgressNotice: boolean;
}

const DEFAULT_CONCURRENCY = 4;
const MONTHLY_ROOT_TAB = ROOT_CONFIG.SHEET_NAMES.PACKAGE;
const GOOGLE_RETRY_LIMIT = 7;
const INDIVIDUAL_SNAPSHOT_ROW_LIMIT = 300;
const INDIVIDUAL_SNAPSHOT_COLUMN_LIMIT = 600;
const INDIVIDUAL_SNAPSHOT_FALLBACK_ROW_LIMIT = 120;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeCell = (value: unknown): string =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

const normalizeKeyPart = (value: string): string =>
  normalizeCell(value).replace(/[\s()]/g, '').toLowerCase();

const normalizeKeyword = (value: string): string =>
  normalizeKeyPart(value.replace(/\([^)]*\)/g, ''));

const buildMatchKey = (company: string, keyword: string): string =>
  `${normalizeKeyPart(company)}::${normalizeKeyword(keyword)}`;

const extractSpreadsheetId = (url: string): string =>
  normalizeCell(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? '';

const extractSheetGid = (url: string): number | null => {
  const match = normalizeCell(url).match(/[?#&]gid=(\d+)/);

  return match ? Number(match[1]) : null;
};

const parseBooleanCell = (value: string): boolean =>
  ['o', '1', 'true', 'y', 'yes', '노출'].includes(
    normalizeCell(value).toLowerCase()
  );

const isExcludedMarkerRow = (row: string[]): boolean => {
  const rowText = row.join(' ').replace(/\s+/g, '');

  return /자료미전달리스트|지료미전달리스트/.test(rowText);
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRetryableGoogleError = (error: unknown): boolean => {
  const message = getErrorMessage(error);

  return (
    message.includes('[429]') ||
    message.includes('Quota exceeded') ||
    message.includes('Rate Limit') ||
    message.includes('[500]') ||
    message.includes('[502]') ||
    message.includes('[503]') ||
    message.includes('[504]')
  );
};

const withGoogleRetry = async <T>(
  operation: () => Promise<T>,
  label: string
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < GOOGLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableGoogleError(error) || attempt === GOOGLE_RETRY_LIMIT - 1) {
        break;
      }

      const waitMs = Math.min(
        60000,
        1200 * 2 ** attempt + Math.floor(Math.random() * 800)
      );
      logger.warn(
        `${label} 재시도 ${attempt + 1}/${GOOGLE_RETRY_LIMIT - 1} (${Math.round(waitMs / 1000)}초 대기): ${getErrorMessage(error)}`
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
};

const getGoogleSheetAuth = (): JWT => {
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

const openSpreadsheet = async (
  spreadsheetId: string,
  auth: JWT
): Promise<GoogleSpreadsheet> => {
  const doc = new GoogleSpreadsheet(spreadsheetId, auth);
  await withGoogleRetry(
    () => doc.loadInfo(),
    `스프레드시트 정보 로드 ${spreadsheetId}`
  );
  return doc;
};

const getRequiredSheet = (
  doc: GoogleSpreadsheet,
  title: string
): GoogleSpreadsheetWorksheet => {
  const sheet = doc.sheetsByTitle[title];

  if (!sheet) {
    throw new Error(`"${title}" 탭을 찾을 수 없음`);
  }

  return sheet;
};

const getCellValue = (
  sheet: GoogleSpreadsheetWorksheet,
  rowIndex: number,
  columnIndex: number
): string => normalizeCell(sheet.getCell(rowIndex, columnIndex).formattedValue ?? sheet.getCell(rowIndex, columnIndex).value);

const loadGrid = async (
  sheet: GoogleSpreadsheetWorksheet,
  rowCount: number,
  columnCount: number
): Promise<string[][]> => {
  const endRowIndex = Math.min(sheet.rowCount, rowCount);
  const endColumnIndex = Math.min(sheet.columnCount, columnCount);

  await withGoogleRetry(
    () =>
      sheet.loadCells({
        startRowIndex: 0,
        endRowIndex,
        startColumnIndex: 0,
        endColumnIndex,
      }),
    `${sheet.title} 셀 로드`
  );

  return Array.from({ length: endRowIndex }, (_, rowIndex) =>
    Array.from({ length: endColumnIndex }, (_, columnIndex) =>
      getCellValue(sheet, rowIndex, columnIndex)
    )
  );
};

const loadHeaderRow = async (
  sheet: GoogleSpreadsheetWorksheet
): Promise<string[]> => {
  const endColumnIndex = Math.min(sheet.columnCount, 600);

  await withGoogleRetry(
    () =>
      sheet.loadCells({
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex,
      }),
    `${sheet.title} 헤더 로드`
  );

  return Array.from({ length: endColumnIndex }, (_, columnIndex) =>
    getCellValue(sheet, 0, columnIndex)
  );
};

const loadColumnValues = async (
  sheet: GoogleSpreadsheetWorksheet,
  columnIndex: number
): Promise<string[]> => {
  await withGoogleRetry(
    () =>
      sheet.loadCells({
        startRowIndex: 0,
        endRowIndex: sheet.rowCount,
        startColumnIndex: columnIndex,
        endColumnIndex: columnIndex + 1,
      }),
    `${sheet.title} 컬럼 로드`
  );

  return Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    getCellValue(sheet, rowIndex, columnIndex)
  );
};

const loadIndividualSheetSnapshot = async (
  sheet: GoogleSpreadsheetWorksheet
): Promise<IndividualSheetSnapshot> => {
  const endRowIndex = Math.min(sheet.rowCount, INDIVIDUAL_SNAPSHOT_ROW_LIMIT);
  const endColumnIndex = Math.min(
    sheet.columnCount,
    INDIVIDUAL_SNAPSHOT_COLUMN_LIMIT
  );
  const loadSnapshot = async (rowLimit: number): Promise<string[][]> => {
    await withGoogleRetry(
      () =>
        sheet.loadCells({
          startRowIndex: 0,
          endRowIndex: rowLimit,
          startColumnIndex: 0,
          endColumnIndex,
        }),
      `${sheet.title} 스냅샷 로드`
    );

    return Array.from({ length: rowLimit }, (_, rowIndex) =>
      Array.from({ length: endColumnIndex }, (_, columnIndex) =>
        getCellValue(sheet, rowIndex, columnIndex)
      )
    );
  };

  let rows: string[][];

  try {
    rows = await loadSnapshot(endRowIndex);
  } catch (error) {
    if (!getErrorMessage(error).includes('Cannot create a string longer')) {
      throw error;
    }

    const fallbackEndRowIndex = Math.min(
      sheet.rowCount,
      INDIVIDUAL_SNAPSHOT_FALLBACK_ROW_LIMIT
    );
    logger.warn(
      `${sheet.title} 스냅샷이 커서 ${fallbackEndRowIndex}행 범위로 재시도`
    );
    rows = await loadSnapshot(fallbackEndRowIndex);
  }

  return {
    headers: rows[0] ?? [],
    rows,
  };
};

const getKstDate = (): Date => {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return new Date(`${formatted}T00:00:00+09:00`);
};

const getKstDateParts = (date: Date): DateParts => {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const month = parts.find(({ type }) => type === 'month')?.value ?? '';
  const day = parts.find(({ type }) => type === 'day')?.value ?? '';

  return {
    month: Number(month),
    day: Number(day),
  };
};

const formatKoreanDateLabel = (date: Date): string => {
  const { month, day } = getKstDateParts(date);

  return `${month}월${day}일`;
};

const parseDateArg = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`날짜 형식은 YYYY-MM-DD만 허용됨: ${value}`);
  }

  return new Date(`${value}T00:00:00+09:00`);
};

const parsePositiveInteger = (value: string): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`양수 정수만 허용됨: ${value}`);
  }

  return parsed;
};

const parseIntegerCell = (value: string): number | null => {
  const normalized = normalizeCell(value);

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
};

const getA1ColumnName = (columnIndex: number): string => {
  let currentIndex = columnIndex + 1;
  let columnName = '';

  while (currentIndex > 0) {
    const remainder = (currentIndex - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    currentIndex = Math.floor((currentIndex - 1) / 26);
  }

  return columnName;
};

const buildCountifFormulaFromDateColumn = (
  dateColumnIndex: number,
  rowNumber: number
): string => {
  const columnName = getA1ColumnName(dateColumnIndex);

  return `=COUNTIF(${columnName}${rowNumber}:${rowNumber},"o")`;
};

const calculateIncrementalCumulativeNumber = (
  currentCumulativeNumber: number,
  currentDateValue: string,
  nextDateValue: string
): number => {
  const currentDateIsExposed = normalizeKeyPart(currentDateValue) === 'o';
  const nextDateIsExposed = normalizeKeyPart(nextDateValue) === 'o';

  if (!currentDateIsExposed && nextDateIsExposed) {
    return currentCumulativeNumber + 1;
  }

  if (currentDateIsExposed && !nextDateIsExposed) {
    return Math.max(0, currentCumulativeNumber - 1);
  }

  return currentCumulativeNumber;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  let date = getKstDate();
  let dryRun = false;
  let limit = 0;
  let companyLimit = 0;
  let concurrency = DEFAULT_CONCURRENCY;
  let checkCumulative = false;
  let notify = true;
  let exposedOnly = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextArg = args[index + 1];

    if (arg === '--') {
      continue;
    }

    if (arg === '--date' && nextArg) {
      date = parseDateArg(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--limit' && nextArg) {
      limit = parsePositiveInteger(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--company-limit' && nextArg) {
      companyLimit = parsePositiveInteger(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--concurrency' && nextArg) {
      concurrency = parsePositiveInteger(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--write') {
      dryRun = false;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--check-cumulative') {
      checkCumulative = true;
      dryRun = true;
      continue;
    }

    if (arg === '--notify') {
      notify = true;
      continue;
    }

    if (arg === '--no-notify') {
      notify = false;
      continue;
    }

    if (arg === '--exposed-only') {
      exposedOnly = true;
      continue;
    }

    if (arg === '--include-unexposed') {
      exposedOnly = false;
      continue;
    }

    throw new Error(`알 수 없는 인자: ${arg}`);
  }

  return {
    date,
    dryRun,
    limit,
    companyLimit,
    concurrency,
    checkCumulative,
    notify,
    exposedOnly,
  };
};

const limitRowsByCompany = (
  rows: ProgramRootRow[],
  companyLimit: number
): ProgramRootRow[] => {
  if (companyLimit < 1) {
    return rows;
  }

  const selectedCompanies = new Set<string>();

  for (const row of rows) {
    if (!selectedCompanies.has(row.company)) {
      selectedCompanies.add(row.company);
    }

    if (selectedCompanies.size >= companyLimit) {
      break;
    }
  }

  return rows.filter((row) => selectedCompanies.has(row.company));
};

const loadProgramRootRows = async (
  auth: JWT,
  limit: number,
  companyLimit: number,
  exposedOnly: boolean
): Promise<ProgramRootRow[]> => {
  const doc = await openSpreadsheet(ROOT_CONFIG.SHEET_ID, auth);
  const sheet = getRequiredSheet(doc, MONTHLY_ROOT_TAB);
  const rows = await loadGrid(sheet, sheet.rowCount, 6);
  let currentCompany = '';
  let currentLink = '';
  const loadedRows: ProgramRootRow[] = [];

  for (let index = 3; index < rows.length; index += 1) {
    const row = rows[index];

    if (isExcludedMarkerRow(row)) {
      break;
    }

    const company = normalizeCell(row[0]);
    const keyword = normalizeCell(row[1]);
    const link = normalizeCell(row[5]);

    if (company) {
      currentCompany = company;
    }

    if (link) {
      currentLink = link;
    }

    if (!currentCompany || !keyword) {
      continue;
    }

    loadedRows.push({
      rowNumber: index + 1,
      company: currentCompany,
      keyword,
      baseKeyword: keyword.replace(/\([^)]*\)/g, '').trim(),
      isExposed: parseBooleanCell(row[4]),
      link: currentLink,
    });
  }

  const targetRows = exposedOnly
    ? loadedRows.filter(({ isExposed }) => isExposed)
    : loadedRows;
  const companyLimitedRows = limitRowsByCompany(targetRows, companyLimit);

  return limit > 0 ? companyLimitedRows.slice(0, limit) : companyLimitedRows;
};

const loadMonthlyRootRows = async (auth: JWT): Promise<MonthlyRootRow[]> => {
  const doc = await openSpreadsheet(ROOT_CONFIG.SHEET_ID, auth);
  const sheet = getRequiredSheet(doc, MONTHLY_ROOT_TAB);
  const rows = await loadGrid(sheet, sheet.rowCount, 8);
  let currentCompany = '';
  let currentSheetId = '';
  let currentGid: number | null = null;
  const loadedRows: MonthlyRootRow[] = [];

  for (let index = 3; index < rows.length; index += 1) {
    const row = rows[index];

    if (isExcludedMarkerRow(row)) {
      break;
    }

    const company = normalizeCell(row[0]);
    const keyword = normalizeCell(row[1]);
    const link = normalizeCell(row[5]);
    const sheetId = extractSpreadsheetId(row[5]);
    const gid = extractSheetGid(link);

    if (company) {
      currentCompany = company;
    }

    if (sheetId) {
      currentSheetId = sheetId;
      currentGid = gid;
    }

    if (!keyword || !currentCompany) {
      continue;
    }

    loadedRows.push({
      rowNumber: index + 1,
      company: currentCompany,
      keyword,
      sheetId: currentSheetId,
      gid: currentGid,
    });
  }

  return loadedRows;
};

const buildMonthlyRowMap = (
  rows: MonthlyRootRow[]
): Map<string, MonthlyRootRow[]> => {
  const rowMap = new Map<string, MonthlyRootRow[]>();

  rows.forEach((row) => {
    const key = buildMatchKey(row.company, row.keyword);
    const existingRows = rowMap.get(key) ?? [];
    rowMap.set(key, [...existingRows, row]);
  });

  return rowMap;
};

const chooseIndividualSheet = (
  doc: GoogleSpreadsheet,
  gid: number | null
): GoogleSpreadsheetWorksheet =>
  (gid !== null ? doc.sheetsById[gid] : undefined) ??
  doc.sheetsByTitle['시트1'] ??
  doc.sheetsByIndex[0];

const getHeaderIndex = (headers: string[], aliases: string[]): number => {
  const normalizedAliases = aliases.map(normalizeKeyPart);

  return headers.findIndex((header) =>
    normalizedAliases.includes(normalizeKeyPart(header))
  );
};

const findKeywordRowIndex = (values: string[], keyword: string): number => {
  const normalizedKeyword = normalizeKeyword(keyword);

  return values.findIndex(
    (value, index) => index > 0 && normalizeKeyword(value) === normalizedKeyword
  );
};

const buildKeywordRowIndexMap = (values: string[]): Map<string, number[]> => {
  const rowIndexMap = new Map<string, number[]>();

  values.forEach((value, index) => {
    if (index === 0) {
      return;
    }

    const normalizedKeyword = normalizeKeyword(value);

    if (!normalizedKeyword) {
      return;
    }

    const rowIndexes = rowIndexMap.get(normalizedKeyword) ?? [];
    rowIndexMap.set(normalizedKeyword, [...rowIndexes, index]);
  });

  return rowIndexMap;
};

const parseDateHeader = (header: string): DateParts | null => {
  const normalized = normalizeCell(header);
  const koreanMatch = normalized.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (koreanMatch) {
    return {
      month: Number(koreanMatch[1]),
      day: Number(koreanMatch[2]),
    };
  }

  if (slashMatch) {
    return {
      month: Number(slashMatch[1]),
      day: Number(slashMatch[2]),
    };
  }

  return null;
};

const getDateKey = (parts: DateParts): string => `${parts.month}/${parts.day}`;

const getDateNumber = (parts: DateParts): number => parts.month * 100 + parts.day;

const findFirstBlankColumnIndex = (
  headers: string[],
  startColumnIndex: number
): number => {
  for (
    let columnIndex = Math.max(0, startColumnIndex);
    columnIndex < headers.length;
    columnIndex += 1
  ) {
    if (!normalizeCell(headers[columnIndex])) {
      return columnIndex;
    }
  }

  return Math.max(0, startColumnIndex, headers.length);
};

const parseExtensionDate = (value: string): DateParts | null => {
  const normalized = normalizeCell(value);
  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
  const koreanMatch = normalized.match(/^(\d{1,2})월\s*(\d{1,2})일$/);

  if (slashMatch) {
    return {
      month: Number(slashMatch[1]),
      day: Number(slashMatch[2]),
    };
  }

  if (koreanMatch) {
    return {
      month: Number(koreanMatch[1]),
      day: Number(koreanMatch[2]),
    };
  }

  return null;
};

const formatDateLabelLikeHeader = (
  date: Date,
  sampleHeader: string
): string => {
  const { month, day } = getKstDateParts(date);

  if (/^\d{1,2}\/\d{1,2}$/.test(normalizeCell(sampleHeader))) {
    return `${month}/${day}`;
  }

  return `${month}월${day}일`;
};

const resolveDateColumn = (
  headers: string[],
  date: Date
): DateColumnResolution => {
  const targetParts = getKstDateParts(date);
  const targetDateNumber = getDateNumber(targetParts);
  const dateHeaders = headers.flatMap((header, index) => {
    const parts = parseDateHeader(header);

    return parts ? [{ index, header, parts }] : [];
  });
  const lastDateHeader = dateHeaders[dateHeaders.length - 1];

  if (!lastDateHeader) {
    return {
      columnIndex: findFirstBlankColumnIndex(headers, 0),
      label: formatKoreanDateLabel(date),
      shouldCreate: true,
    };
  }

  if (getDateNumber(lastDateHeader.parts) < targetDateNumber) {
    return {
      columnIndex: findFirstBlankColumnIndex(headers, lastDateHeader.index + 1),
      label: formatDateLabelLikeHeader(date, lastDateHeader.header),
      shouldCreate: true,
    };
  }

  const existingDateHeader = [...dateHeaders]
    .reverse()
    .find(
      ({ parts }) =>
        parts.month === targetParts.month && parts.day === targetParts.day
    );

  if (existingDateHeader) {
    return {
      columnIndex: existingDateHeader.index,
      label: normalizeCell(existingDateHeader.header),
      shouldCreate: false,
    };
  }

  return {
    columnIndex: findFirstBlankColumnIndex(headers, lastDateHeader.index + 1),
    label: formatDateLabelLikeHeader(date, lastDateHeader.header),
    shouldCreate: true,
  };
};

const buildNoticeFlags = (
  extensionValue: string,
  todayCumulativeNumber: number | null
): Pick<
  CumulativeCalculationResult,
  'terminationNotice' | 'extensionReviewNotice' | 'extensionProgressNotice'
> => {
  const normalizedExtensionValue = normalizeKeyPart(extensionValue);

  return {
    terminationNotice:
      normalizedExtensionValue === 'x' && todayCumulativeNumber === 25,
    extensionReviewNotice:
      normalizedExtensionValue !== 'o' &&
      normalizedExtensionValue !== 'x' &&
      todayCumulativeNumber !== null &&
      todayCumulativeNumber >= 15,
    extensionProgressNotice:
      normalizedExtensionValue === 'o' &&
      todayCumulativeNumber !== null &&
      todayCumulativeNumber >= 26,
  };
};

const findRightmostDateColumn = (
  headers: string[],
  targetParts: DateParts,
  maxColumnIndex: number
): number | null => {
  const targetKey = getDateKey(targetParts);

  for (
    let columnIndex = Math.min(maxColumnIndex, headers.length - 1);
    columnIndex >= 0;
    columnIndex -= 1
  ) {
    const parts = parseDateHeader(headers[columnIndex]);

    if (parts && getDateKey(parts) === targetKey) {
      return columnIndex;
    }
  }

  return null;
};

const calculateCumulativeValue = (
  rowValues: string[],
  headers: string[],
  dateColumn: DateColumnResolution,
  targetRowNumber: number,
  currentCumulativeValue: string,
  currentDateValue: string,
  nextDateValue: string,
  extensionValue: string
): CumulativeCalculationResult => {
  const normalizedExtensionValue = normalizeKeyPart(extensionValue);
  const extensionDate = parseExtensionDate(extensionValue);
  const currentCumulativeNumber = parseIntegerCell(currentCumulativeValue);
  const buildResult = (
    value: string,
    formula: string,
    nextExtensionValue: string,
    reason: string,
    todayCumulativeNumber: number | null
  ): CumulativeCalculationResult => ({
    value,
    formula,
    nextExtensionValue,
    reason,
    todayCumulativeNumber,
    ...buildNoticeFlags(extensionValue, todayCumulativeNumber),
  });

  if (normalizedExtensionValue === 'x') {
    const todayCumulativeNumber =
      currentCumulativeNumber === null
        ? null
        : calculateIncrementalCumulativeNumber(
            currentCumulativeNumber,
            currentDateValue,
            nextDateValue
          );

    return buildResult(
      currentCumulativeValue,
      '',
      extensionValue,
      '연장=x 유지',
      todayCumulativeNumber
    );
  }

  if (extensionDate) {
    const startColumnIndex = findRightmostDateColumn(
      headers,
      extensionDate,
      dateColumn.columnIndex
    );

    if (startColumnIndex === null) {
      return buildResult(
        currentCumulativeValue,
        '',
        extensionValue,
        `연장 시작일 ${extensionValue} 컬럼 없음`,
        null
      );
    }

    let count = 0;

    for (
      let columnIndex = startColumnIndex;
      columnIndex <= dateColumn.columnIndex;
      columnIndex += 1
    ) {
      const value =
        columnIndex === dateColumn.columnIndex
          ? nextDateValue
          : normalizeCell(rowValues[columnIndex]);

      if (normalizeKeyPart(value) === 'o') {
        count += 1;
      }
    }

    return buildResult(
      String(count),
      '',
      extensionValue,
      `연장 시작일 ${extensionValue}부터 계산`,
      count
    );
  }

  if (currentCumulativeNumber === null) {
    return buildResult(
      currentCumulativeValue,
      '',
      extensionValue,
      '기존 누적값 숫자 아님',
      null
    );
  }

  const nextCumulativeNumber = calculateIncrementalCumulativeNumber(
    currentCumulativeNumber,
    currentDateValue,
    nextDateValue
  );

  if (
    normalizedExtensionValue === 'o' &&
    currentCumulativeNumber < 26 &&
    nextCumulativeNumber >= 26
  ) {
    return buildResult(
      '',
      buildCountifFormulaFromDateColumn(
        dateColumn.columnIndex,
        targetRowNumber
      ),
      dateColumn.label,
      '연장=o 26일 도달, 오늘부터 1일 재계산',
      nextCumulativeNumber
    );
  }

  if (normalizeKeyPart(currentDateValue) !== 'o' && normalizeKeyPart(nextDateValue) === 'o') {
    return buildResult(
      String(nextCumulativeNumber),
      '',
      extensionValue,
      '오늘 신규 노출 +1',
      nextCumulativeNumber
    );
  }

  if (normalizeKeyPart(currentDateValue) === 'o' && normalizeKeyPart(nextDateValue) !== 'o') {
    return buildResult(
      String(nextCumulativeNumber),
      '',
      extensionValue,
      '오늘 노출 제거 -1',
      nextCumulativeNumber
    );
  }

  return buildResult(
    currentCumulativeValue,
    '',
    extensionValue,
    '오늘 상태 변화 없음',
    nextCumulativeNumber
  );
};

const processInBatches = async <T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];

  for (let start = 0; start < items.length; start += concurrency) {
    const batch = items.slice(start, start + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, index) => handler(item, start + index))
    );
    results.push(...batchResults);

    if (start + concurrency < items.length) {
      await sleep(1200);
    }
  }

  return results;
};

const aggregatePlansByCell = (
  plans: IndividualWritePlan[]
): IndividualWritePlan[] => {
  const planMap = new Map<string, IndividualWritePlan>();

  plans.forEach((plan) => {
    const key = [
      plan.spreadsheetTitle,
      plan.sheetTitle,
      plan.targetRowNumber,
      plan.targetColumnNumber,
      plan.dateColumnLabel,
    ].join('::');
    const existingPlan = planMap.get(key);

    if (!existingPlan) {
      planMap.set(key, plan);
      return;
    }

    planMap.set(key, {
      ...existingPlan,
      shouldCreateDateColumn:
        existingPlan.shouldCreateDateColumn || plan.shouldCreateDateColumn,
      nextValue:
        existingPlan.nextValue === 'o' || plan.nextValue === 'o' ? 'o' : '',
      todayCumulativeNumber:
        existingPlan.todayCumulativeNumber ?? plan.todayCumulativeNumber,
      terminationNotice: existingPlan.terminationNotice || plan.terminationNotice,
      extensionReviewNotice:
        existingPlan.extensionReviewNotice || plan.extensionReviewNotice,
      extensionProgressNotice:
        existingPlan.extensionProgressNotice || plan.extensionProgressNotice,
    });
  });

  return Array.from(planMap.values());
};

const formatNoticeKeyword = (plan: IndividualWritePlan): string => {
  const keyword = normalizeCell(plan.keyword.replace(/\([^)]*\)/g, ''));
  const cumulativeDisplay =
    plan.todayCumulativeNumber === null
      ? '계산불가'
      : `${plan.todayCumulativeNumber}일`;
  const extensionDisplay = plan.extensionValue || '빈칸';

  return `- ${plan.company} / ${keyword} (누적 ${cumulativeDisplay}, 연장=${extensionDisplay})`;
};

const formatNoticeSection = (
  title: string,
  plans: IndividualWritePlan[],
  limit = 20
): string => {
  if (plans.length === 0) {
    return '';
  }

  const lines = plans.slice(0, limit).map(formatNoticeKeyword);
  const remaining = plans.length - lines.length;

  if (remaining > 0) {
    lines.push(`- 외 ${remaining}건`);
  }

  return [`[${title}] ${plans.length}건`, ...lines].join('\n');
};

const sendExtensionNoticeMessage = async (params: {
  dateColumnLabel: string;
  sourceCount: number;
  matchedCount: number;
  changedCount: number;
  terminationPlans: IndividualWritePlan[];
  extensionReviewPlans: IndividualWritePlan[];
  extensionProgressPlans: IndividualWritePlan[];
}): Promise<boolean> => {
  const sections = [
    formatNoticeSection('종료건', params.terminationPlans),
    formatNoticeSection('연장 확인건', params.extensionReviewPlans),
    formatNoticeSection('연장진행건', params.extensionProgressPlans),
  ].filter(Boolean);

  if (sections.length === 0) {
    return false;
  }

  const text = [
    `[루트개별시트 연장 알림] ${params.dateColumnLabel}`,
    `작업 ${params.sourceCount}개 / 매칭 ${params.matchedCount}개 / 변경 ${params.changedCount}개`,
    '',
    sections.join('\n\n'),
  ].join('\n');

  return sendDoorayMessage(text, '루트개별시트봇');
};

const buildIndividualWritePlansForSheet = async (
  auth: JWT,
  group: SheetMatchedPairGroup,
  date: Date
): Promise<{ plans: IndividualWritePlan[]; skips: IndividualSkip[] }> => {
  try {
    const doc = await openSpreadsheet(group.sheetId, auth);
    const sheet = chooseIndividualSheet(doc, group.gid);
    const { headers, rows } = await loadIndividualSheetSnapshot(sheet);
    const keywordColumnIndex = getHeaderIndex(headers, ['키워드']);
    const resolvedKeywordColumnIndex = keywordColumnIndex >= 0 ? keywordColumnIndex : 0;
    const cumulativeColumnIndex = getHeaderIndex(headers, [
      '누적노출일',
      '누적 노출일',
    ]);
    const extensionColumnIndex = getHeaderIndex(headers, ['연장']);
    const dateColumn = resolveDateColumn(headers, date);

    const keywordValues = rows.map(
      (row) => row[resolvedKeywordColumnIndex] ?? ''
    );
    const dateValues = dateColumn.shouldCreate
      ? []
      : rows.map((row) => row[dateColumn.columnIndex] ?? '');
    const cumulativeValues =
      cumulativeColumnIndex >= 0
        ? rows.map((row) => row[cumulativeColumnIndex] ?? '')
        : [];
    const extensionValues =
      extensionColumnIndex >= 0
        ? rows.map((row) => row[extensionColumnIndex] ?? '')
        : [];
    const keywordRowIndexMap = buildKeywordRowIndexMap(keywordValues);
    const usedKeywordCountMap = new Map<string, number>();
    const plans: IndividualWritePlan[] = [];
    const skips: IndividualSkip[] = [];

    for (const { programRow, monthlyRow } of group.pairs) {
      const normalizedKeyword = normalizeKeyword(programRow.baseKeyword);
      const candidateRowIndexes = keywordRowIndexMap.get(normalizedKeyword) ?? [];
      const usedCount = usedKeywordCountMap.get(normalizedKeyword) ?? 0;
      const targetRowIndex = candidateRowIndexes[usedCount] ?? -1;
      usedKeywordCountMap.set(normalizedKeyword, usedCount + 1);

      if (targetRowIndex < 0) {
        skips.push({
          company: programRow.company,
          keyword: programRow.keyword,
          reason: `개별시트 "${doc.title}"에서 ${usedCount + 1}번째 키워드 행 못 찾음`,
        });
        continue;
      }

      const currentValue = normalizeCell(dateValues[targetRowIndex]);
      const nextValue = programRow.isExposed ? 'o' : '';
      let currentCumulativeValue = '';
      let nextCumulativeValue = '';
      let nextCumulativeFormula = '';
      let extensionValue = '';
      let nextExtensionValue = '';
      let cumulativeReason = '누적 컬럼 없음';
      let todayCumulativeNumber: number | null = null;
      let terminationNotice = false;
      let extensionReviewNotice = false;
      let extensionProgressNotice = false;

      if (cumulativeColumnIndex >= 0) {
        currentCumulativeValue = normalizeCell(cumulativeValues[targetRowIndex]);
        extensionValue =
          extensionColumnIndex >= 0
            ? normalizeCell(extensionValues[targetRowIndex])
            : '';
        nextExtensionValue = extensionValue;

        const rowValues = rows[targetRowIndex] ?? [];
        const cumulativeResult = calculateCumulativeValue(
          rowValues,
          headers,
          dateColumn,
          targetRowIndex + 1,
          currentCumulativeValue,
          currentValue,
          nextValue,
          extensionValue
        );

        nextCumulativeValue = cumulativeResult.value;
        nextCumulativeFormula = cumulativeResult.formula;
        nextExtensionValue = cumulativeResult.nextExtensionValue;
        cumulativeReason = cumulativeResult.reason;
        todayCumulativeNumber = cumulativeResult.todayCumulativeNumber;
        terminationNotice = cumulativeResult.terminationNotice;
        extensionReviewNotice = cumulativeResult.extensionReviewNotice;
        extensionProgressNotice = cumulativeResult.extensionProgressNotice;
      }

      plans.push({
        spreadsheetId: group.sheetId,
        company: programRow.company,
        keyword: programRow.keyword,
        sourceRowNumber: programRow.rowNumber,
        monthlyRowNumber: monthlyRow.rowNumber,
        spreadsheetTitle: doc.title,
        sheetTitle: sheet.title,
        targetColumnNumber: dateColumn.columnIndex + 1,
        targetRowNumber: targetRowIndex + 1,
        dateColumnLabel: dateColumn.label,
        shouldCreateDateColumn: dateColumn.shouldCreate,
        currentValue,
        nextValue,
        cumulativeColumnNumber:
          cumulativeColumnIndex >= 0 ? cumulativeColumnIndex + 1 : null,
        currentCumulativeValue,
        nextCumulativeValue,
        nextCumulativeFormula,
        extensionColumnNumber:
          extensionColumnIndex >= 0 ? extensionColumnIndex + 1 : null,
        extensionValue,
        nextExtensionValue,
        cumulativeReason,
        todayCumulativeNumber,
        terminationNotice,
        extensionReviewNotice,
        extensionProgressNotice,
      });
    }

    return { plans, skips };
  } catch (error) {
    return {
      plans: [],
      skips: group.pairs.map(({ programRow }) => ({
        company: programRow.company,
        keyword: programRow.keyword,
        reason: error instanceof Error ? error.message : String(error),
      })),
    };
  }
};

const groupMatchedPairsBySheet = (
  pairs: MatchedPair[]
): { groups: SheetMatchedPairGroup[]; skips: IndividualSkip[] } => {
  const groupMap = new Map<
    string,
    { sheetId: string; gid: number | null; pairs: MatchedPair[] }
  >();
  const skips: IndividualSkip[] = [];

  pairs.forEach((pair) => {
    const { sheetId, gid } = pair.monthlyRow;

    if (!sheetId) {
      skips.push({
        company: pair.programRow.company,
        keyword: pair.programRow.keyword,
        reason: '월보장 시트에 개별 시트 링크 없음',
      });
      return;
    }

    const groupKey = `${sheetId}::${gid ?? ''}`;
    const existingGroup = groupMap.get(groupKey) ?? {
      sheetId,
      gid,
      pairs: [],
    };
    groupMap.set(groupKey, {
      ...existingGroup,
      pairs: [...existingGroup.pairs, pair],
    });
  });

  return {
    groups: Array.from(groupMap.values()),
    skips,
  };
};

const writeIndividualPlans = async (
  auth: JWT,
  plans: IndividualWritePlan[]
): Promise<void> => {
  const groupedPlans = new Map<string, IndividualWritePlan[]>();

  plans.forEach((plan) => {
    const key = `${plan.spreadsheetId}::${plan.sheetTitle}`;
    const existingPlans = groupedPlans.get(key) ?? [];
    groupedPlans.set(key, [...existingPlans, plan]);
  });

  for (const [, sheetPlans] of groupedPlans) {
    const firstPlan = sheetPlans[0];
    const doc = await openSpreadsheet(firstPlan.spreadsheetId, auth);
    const sheet =
      doc.sheetsByTitle[firstPlan.sheetTitle] ?? chooseIndividualSheet(doc, null);
    const writeColumnIndexes = sheetPlans.map(
      ({ targetColumnNumber }) => targetColumnNumber - 1
    );
    const maxColumnIndex = Math.max(...writeColumnIndexes);
    const minColumnIndex = Math.min(...writeColumnIndexes);
    const maxRowIndex = Math.max(
      ...sheetPlans.map(({ targetRowNumber }) => targetRowNumber - 1)
    );

    if (sheet.columnCount <= maxColumnIndex) {
      await withGoogleRetry(
        () =>
          sheet.resize({
            rowCount: sheet.rowCount,
            columnCount: maxColumnIndex + 1,
          }),
        `${sheet.title} 컬럼 확장`
      );
    }

    await withGoogleRetry(
      () =>
        sheet.loadCells({
          startRowIndex: 0,
          endRowIndex: maxRowIndex + 1,
          startColumnIndex: minColumnIndex,
          endColumnIndex: maxColumnIndex + 1,
        }),
      `${sheet.title} 쓰기 범위 로드`
    );

    sheetPlans.forEach((plan) => {
      const columnIndex = plan.targetColumnNumber - 1;
      const rowIndex = plan.targetRowNumber - 1;

      if (plan.shouldCreateDateColumn) {
        sheet.getCell(0, columnIndex).value = plan.dateColumnLabel;
      }

      sheet.getCell(rowIndex, columnIndex).value = plan.nextValue;
    });

    await withGoogleRetry(
      () => sheet.saveUpdatedCells(),
      `${sheet.title} 셀 저장`
    );

    logger.success(
      `${firstPlan.spreadsheetTitle} / ${sheet.title}: ${sheetPlans.length}셀 기록 완료`
    );

    await sleep(700);
  }
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const auth = getGoogleSheetAuth();
  const dateColumnLabel = formatKoreanDateLabel(options.date);

  logger.summary.start('ROOT INDIVIDUAL EXPOSURE SYNC', [
    { label: '날짜 컬럼', value: dateColumnLabel },
    { label: '모드', value: options.dryRun ? 'dry-run' : 'write' },
    {
      label: 'Dooray 알림',
      value: options.notify && !options.dryRun ? '사용' : '없음',
    },
    { label: '대상 제한', value: options.limit > 0 ? `${options.limit}개` : '전체' },
    {
      label: '업체 제한',
      value: options.companyLimit > 0 ? `상단 ${options.companyLimit}개 업체` : '전체',
    },
    { label: '대상 필터', value: options.exposedOnly ? '노출=o만' : '전체' },
    { label: '동시성', value: `${options.concurrency}` },
  ]);

  const programRows = await loadProgramRootRows(
    auth,
    options.limit,
    options.companyLimit,
    options.exposedOnly
  );
  const monthlyRows = await loadMonthlyRootRows(auth);
  const monthlyRowMap = buildMonthlyRowMap(monthlyRows);

  const matchedPairs = programRows.flatMap((programRow) => {
    const rows = monthlyRowMap.get(buildMatchKey(programRow.company, programRow.baseKeyword)) ?? [];

    if (rows.length === 0) {
      return [];
    }

    return [
      {
        programRow,
        monthlyRow: rows[0],
        duplicateCount: rows.length,
      },
    ];
  });
  const missingMonthlyRows = programRows.filter(
    (programRow) =>
      !monthlyRowMap.has(buildMatchKey(programRow.company, programRow.baseKeyword))
  );
  const duplicateMatches = matchedPairs.filter(({ duplicateCount }) => duplicateCount > 1);

  const groupedMatchedPairs = groupMatchedPairsBySheet(matchedPairs);
  const results = await processInBatches(
    groupedMatchedPairs.groups,
    options.concurrency,
    (group) => buildIndividualWritePlansForSheet(auth, group, options.date)
  );
  const rawPlans = results.flatMap(({ plans: resultPlans }) => resultPlans);
  const plans = aggregatePlansByCell(rawPlans);
  const skips = [
    ...groupedMatchedPairs.skips,
    ...missingMonthlyRows.map((row): IndividualSkip => ({
      company: row.company,
      keyword: row.keyword,
      reason: '월보장 시트 매칭 없음',
    })),
    ...results.flatMap(({ skips: resultSkips }) => resultSkips),
  ];
  const changedPlans = plans.filter(
    ({
      currentValue,
      nextValue,
      shouldCreateDateColumn,
    }) =>
      shouldCreateDateColumn || currentValue !== nextValue
  );
  const exposedPlans = plans.filter(({ nextValue }) => nextValue === 'o');
  const clearPlans = plans.filter(({ nextValue }) => nextValue === '');
  const createDateColumnPlans = plans.filter(
    ({ shouldCreateDateColumn }) => shouldCreateDateColumn
  );
  const createDateColumnSheetCount = new Set(
    createDateColumnPlans.map(
      ({ spreadsheetTitle, sheetTitle, targetColumnNumber }) =>
        `${spreadsheetTitle}::${sheetTitle}::${targetColumnNumber}`
    )
  ).size;
  const cumulativePlans = plans.filter(
    ({ cumulativeColumnNumber }) => cumulativeColumnNumber !== null
  );
  const changedCumulativePlans = cumulativePlans.filter(
    ({ currentCumulativeValue, nextCumulativeValue, nextCumulativeFormula }) =>
      nextCumulativeFormula !== '' ||
      (nextCumulativeValue !== '' && currentCumulativeValue !== nextCumulativeValue)
  );
  const changedExtensionPlans = plans.filter(
    ({ extensionValue, nextExtensionValue }) => extensionValue !== nextExtensionValue
  );
  const terminationNoticePlans = plans.filter(
    ({ terminationNotice }) => terminationNotice
  );
  const extensionReviewNoticePlans = plans.filter(
    ({ extensionReviewNotice }) => extensionReviewNotice
  );
  const extensionProgressNoticePlans = plans.filter(
    ({ extensionProgressNotice }) => extensionProgressNotice
  );

  if (!options.dryRun) {
    await writeIndividualPlans(auth, changedPlans);
  }

  logger.divider('변경 예정 샘플');
  changedPlans.slice(0, 20).forEach((plan) => {
    const columnNote = plan.shouldCreateDateColumn
      ? `새 날짜컬럼 ${plan.dateColumnLabel} C${plan.targetColumnNumber}`
      : `${plan.dateColumnLabel} C${plan.targetColumnNumber}`;

    logger.info(
      `${plan.company} / ${plan.keyword}: ${plan.spreadsheetTitle} ${plan.sheetTitle}!${columnNote} R${plan.targetRowNumber} "${plan.currentValue}" -> "${plan.nextValue}"`
    );
  });

  if (changedPlans.length > 20) {
    logger.info(`...외 ${changedPlans.length - 20}건`);
  }

  if (options.checkCumulative) {
    logger.divider('누적 노출일 계산 샘플');
    changedCumulativePlans.slice(0, 30).forEach((plan) => {
      const nextCumulativeDisplay =
        plan.nextCumulativeFormula || plan.nextCumulativeValue;

      logger.info(
        `${plan.company} / ${plan.keyword}: ${plan.spreadsheetTitle} ${plan.sheetTitle}!C${plan.cumulativeColumnNumber} R${plan.targetRowNumber} "${plan.currentCumulativeValue}" -> "${nextCumulativeDisplay}" (${plan.extensionValue || '연장 빈값'}, ${plan.cumulativeReason})`
      );
    });

    if (changedCumulativePlans.length > 30) {
      logger.info(`...외 ${changedCumulativePlans.length - 30}건`);
    }

    logger.divider('연장 변경 샘플');
    changedExtensionPlans.slice(0, 30).forEach((plan) => {
      logger.info(
        `${plan.company} / ${plan.keyword}: ${plan.spreadsheetTitle} ${plan.sheetTitle}!C${plan.extensionColumnNumber} R${plan.targetRowNumber} "${plan.extensionValue}" -> "${plan.nextExtensionValue}" (${plan.cumulativeReason})`
      );
    });

    if (changedExtensionPlans.length > 30) {
      logger.info(`...외 ${changedExtensionPlans.length - 30}건`);
    }
  }

  const logNoticePlans = (
    title: string,
    noticePlans: IndividualWritePlan[]
  ): void => {
    if (noticePlans.length === 0) {
      return;
    }

    logger.divider(title);
    noticePlans.slice(0, 30).forEach((plan) => {
      const cumulativeDisplay =
        plan.todayCumulativeNumber === null
          ? '계산불가'
          : `${plan.todayCumulativeNumber}일`;
      const extensionDisplay = plan.extensionValue || '빈칸';

      logger.warn(
        `${plan.company} / ${normalizeCell(plan.keyword.replace(/\([^)]*\)/g, ''))}: 누적 ${cumulativeDisplay}, 연장=${extensionDisplay}`
      );
    });

    if (noticePlans.length > 30) {
      logger.warn(`...외 ${noticePlans.length - 30}건`);
    }
  };

  logNoticePlans('종료건', terminationNoticePlans);
  logNoticePlans('연장 확인건', extensionReviewNoticePlans);
  logNoticePlans('연장진행건', extensionProgressNoticePlans);

  const noticeCount =
    terminationNoticePlans.length +
    extensionReviewNoticePlans.length +
    extensionProgressNoticePlans.length;
  let notificationResult = '대상 없음';

  if (options.dryRun) {
    notificationResult = 'dry-run 미전송';
  } else if (!options.notify) {
    notificationResult = '옵션으로 미전송';
  } else if (noticeCount > 0) {
    const sent = await sendExtensionNoticeMessage({
      dateColumnLabel,
      sourceCount: programRows.length,
      matchedCount: plans.length,
      changedCount: changedPlans.length,
      terminationPlans: terminationNoticePlans,
      extensionReviewPlans: extensionReviewNoticePlans,
      extensionProgressPlans: extensionProgressNoticePlans,
    });
    notificationResult = sent ? '전송 완료' : '전송 실패';
  }

  logger.divider('스킵 샘플');
  skips.slice(0, 20).forEach((skip) => {
    logger.warn(`${skip.company} / ${skip.keyword}: ${skip.reason}`);
  });

  if (skips.length > 20) {
    logger.warn(`...외 ${skips.length - 20}건`);
  }

  logger.summary.complete('ROOT INDIVIDUAL EXPOSURE SYNC COMPLETE', [
    { label: '월보장 노출 소스 행', value: `${programRows.length}개` },
    { label: '월보장 매칭', value: `${matchedPairs.length}개` },
    { label: '중복 매칭', value: `${duplicateMatches.length}개` },
    { label: '개별시트 매칭', value: `${plans.length}개` },
    { label: '셀 중복 병합', value: `${rawPlans.length - plans.length}개` },
    { label: '날짜 컬럼 생성 예정', value: `${createDateColumnSheetCount}개 시트` },
    { label: '변경 예정', value: `${changedPlans.length}개` },
    { label: '노출 o 예정', value: `${exposedPlans.length}개` },
    { label: '빈값 예정', value: `${clearPlans.length}개` },
    { label: '누적 계산 대상', value: `${cumulativePlans.length}개` },
    { label: '누적 변경 후보', value: `${changedCumulativePlans.length}개` },
    { label: '연장 변경 후보', value: `${changedExtensionPlans.length}개` },
    { label: '종료건', value: `${terminationNoticePlans.length}개` },
    { label: '연장 확인건', value: `${extensionReviewNoticePlans.length}개` },
    { label: '연장진행건', value: `${extensionProgressNoticePlans.length}개` },
    { label: 'Dooray 알림', value: notificationResult },
    { label: '스킵', value: `${skips.length}개` },
    { label: '실제 쓰기', value: options.dryRun ? '없음' : '완료' },
  ]);
};

main().catch((error) => {
  logger.error(`루트 개별시트 노출여부 동기화 실패: ${(error as Error).message}`);
  process.exit(1);
});
