import * as dotenv from 'dotenv';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { ROOT_CONFIG, TEST_CONFIG } from '../constants';
import { logger } from '../lib/logger';

dotenv.config();

interface CliOptions {
  date: Date;
  dryRun: boolean;
  limit: number;
  concurrency: number;
  checkCumulative: boolean;
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
  extensionValue: string;
  cumulativeReason: string;
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
  pairs: MatchedPair[];
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

const DEFAULT_CONCURRENCY = 4;
const PROGRAM_ROOT_TAB = TEST_CONFIG.SHEET_NAMES.ROOT;
const MONTHLY_ROOT_TAB = ROOT_CONFIG.SHEET_NAMES.PACKAGE;

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

const parseBooleanCell = (value: string): boolean =>
  ['o', '1', 'true', 'y', 'yes', '노출'].includes(
    normalizeCell(value).toLowerCase()
  );

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
  await doc.loadInfo();
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

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex,
    startColumnIndex: 0,
    endColumnIndex,
  });

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

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: 1,
    startColumnIndex: 0,
    endColumnIndex,
  });

  return Array.from({ length: endColumnIndex }, (_, columnIndex) =>
    getCellValue(sheet, 0, columnIndex)
  );
};

const loadColumnValues = async (
  sheet: GoogleSpreadsheetWorksheet,
  columnIndex: number
): Promise<string[]> => {
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: sheet.rowCount,
    startColumnIndex: columnIndex,
    endColumnIndex: columnIndex + 1,
  });

  return Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    getCellValue(sheet, rowIndex, columnIndex)
  );
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

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  let date = getKstDate();
  let dryRun = false;
  let limit = 0;
  let concurrency = DEFAULT_CONCURRENCY;
  let checkCumulative = false;

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

    throw new Error(`알 수 없는 인자: ${arg}`);
  }

  return {
    date,
    dryRun,
    limit,
    concurrency,
    checkCumulative,
  };
};

const loadProgramRootRows = async (
  auth: JWT,
  limit: number
): Promise<ProgramRootRow[]> => {
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, auth);
  const sheet = getRequiredSheet(doc, PROGRAM_ROOT_TAB);
  const rows = await loadGrid(sheet, sheet.rowCount, 12);

  const loadedRows = rows
    .slice(1)
    .flatMap((row, index): ProgramRootRow[] => {
      const company = normalizeCell(row[0]);
      const keyword = normalizeCell(row[1]);

      if (!company || !keyword) {
        return [];
      }

      return [
        {
          rowNumber: index + 2,
          company,
          keyword,
          baseKeyword: keyword.replace(/\([^)]*\)/g, '').trim(),
          isExposed: parseBooleanCell(row[4]),
          link: normalizeCell(row[8]),
        },
      ];
    });

  return limit > 0 ? loadedRows.slice(0, limit) : loadedRows;
};

const loadMonthlyRootRows = async (auth: JWT): Promise<MonthlyRootRow[]> => {
  const doc = await openSpreadsheet(ROOT_CONFIG.SHEET_ID, auth);
  const sheet = getRequiredSheet(doc, MONTHLY_ROOT_TAB);
  const rows = await loadGrid(sheet, sheet.rowCount, 8);
  let currentCompany = '';
  let currentSheetId = '';

  return rows.slice(3).flatMap((row, index): MonthlyRootRow[] => {
    const company = normalizeCell(row[0]);
    const keyword = normalizeCell(row[1]);
    const sheetId = extractSpreadsheetId(row[5]);

    if (company) {
      currentCompany = company;
    }

    if (sheetId) {
      currentSheetId = sheetId;
    }

    if (!keyword || !currentCompany) {
      return [];
    }

    return [
      {
        rowNumber: index + 4,
        company: currentCompany,
        keyword,
        sheetId: currentSheetId,
      },
    ];
  });
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
  doc: GoogleSpreadsheet
): GoogleSpreadsheetWorksheet =>
  doc.sheetsByTitle['시트1'] ?? doc.sheetsByIndex[0];

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
  const dateHeaders = headers.flatMap((header, index) => {
    const parts = parseDateHeader(header);

    return parts ? [{ index, header, parts }] : [];
  });
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

  const lastDateHeader = dateHeaders[dateHeaders.length - 1];

  if (!lastDateHeader) {
    const firstBlankColumnIndex = headers.findIndex(
      (header) => !normalizeCell(header)
    );

    return {
      columnIndex:
        firstBlankColumnIndex >= 0 ? firstBlankColumnIndex : headers.length,
      label: formatKoreanDateLabel(date),
      shouldCreate: true,
    };
  }

  return {
    columnIndex: lastDateHeader.index + 1,
    label: formatDateLabelLikeHeader(date, lastDateHeader.header),
    shouldCreate: true,
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
  currentCumulativeValue: string,
  currentDateValue: string,
  nextDateValue: string,
  extensionValue: string
): { value: string; reason: string } => {
  const extensionDate = parseExtensionDate(extensionValue);

  if (normalizeKeyPart(extensionValue) === 'x') {
    return {
      value: currentCumulativeValue,
      reason: '연장=x 유지',
    };
  }

  if (extensionDate) {
    const startColumnIndex = findRightmostDateColumn(
      headers,
      extensionDate,
      dateColumn.columnIndex
    );

    if (startColumnIndex === null) {
      return {
        value: currentCumulativeValue,
        reason: `연장 시작일 ${extensionValue} 컬럼 없음`,
      };
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

    return {
      value: String(count),
      reason: `연장 시작일 ${extensionValue}부터 계산`,
    };
  }

  const currentCumulativeNumber = parseIntegerCell(currentCumulativeValue);

  if (currentCumulativeNumber === null) {
    return {
      value: currentCumulativeValue,
      reason: '기존 누적값 숫자 아님',
    };
  }

  if (normalizeKeyPart(currentDateValue) !== 'o' && normalizeKeyPart(nextDateValue) === 'o') {
    return {
      value: String(currentCumulativeNumber + 1),
      reason: '오늘 신규 노출 +1',
    };
  }

  if (normalizeKeyPart(currentDateValue) === 'o' && normalizeKeyPart(nextDateValue) !== 'o') {
    return {
      value: String(Math.max(0, currentCumulativeNumber - 1)),
      reason: '오늘 노출 제거 -1',
    };
  }

  return {
    value: currentCumulativeValue,
    reason: '오늘 상태 변화 없음',
  };
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
    });
  });

  return Array.from(planMap.values());
};

const buildIndividualWritePlansForSheet = async (
  auth: JWT,
  group: SheetMatchedPairGroup,
  date: Date
): Promise<{ plans: IndividualWritePlan[]; skips: IndividualSkip[] }> => {
  try {
    const doc = await openSpreadsheet(group.sheetId, auth);
    const sheet = chooseIndividualSheet(doc);
    const headers = await loadHeaderRow(sheet);
    const keywordColumnIndex = getHeaderIndex(headers, ['키워드']);
    const resolvedKeywordColumnIndex = keywordColumnIndex >= 0 ? keywordColumnIndex : 0;
    const cumulativeColumnIndex = getHeaderIndex(headers, [
      '누적노출일',
      '누적 노출일',
    ]);
    const extensionColumnIndex = getHeaderIndex(headers, ['연장']);
    const dateColumn = resolveDateColumn(headers, date);

    const keywordValues = await loadColumnValues(sheet, resolvedKeywordColumnIndex);
    const dateValues = dateColumn.shouldCreate
      ? []
      : await loadColumnValues(sheet, dateColumn.columnIndex);
    const cumulativeValues =
      cumulativeColumnIndex >= 0
        ? await loadColumnValues(sheet, cumulativeColumnIndex)
        : [];
    const extensionValues =
      extensionColumnIndex >= 0
        ? await loadColumnValues(sheet, extensionColumnIndex)
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
      let extensionValue = '';
      let cumulativeReason = '누적 컬럼 없음';

      if (cumulativeColumnIndex >= 0) {
        currentCumulativeValue = normalizeCell(cumulativeValues[targetRowIndex]);
        extensionValue =
          extensionColumnIndex >= 0
            ? normalizeCell(extensionValues[targetRowIndex])
            : '';

        await sheet.loadCells({
          startRowIndex: targetRowIndex,
          endRowIndex: targetRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: Math.min(sheet.columnCount, 600),
        });

        const rowValues = Array.from(
          { length: Math.min(sheet.columnCount, 600) },
          (_, columnIndex) => getCellValue(sheet, targetRowIndex, columnIndex)
        );
        const cumulativeResult = calculateCumulativeValue(
          rowValues,
          headers,
          dateColumn,
          currentCumulativeValue,
          currentValue,
          nextValue,
          extensionValue
        );

        nextCumulativeValue = cumulativeResult.value;
        cumulativeReason = cumulativeResult.reason;
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
        extensionValue,
        cumulativeReason,
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
  const groupMap = new Map<string, MatchedPair[]>();
  const skips: IndividualSkip[] = [];

  pairs.forEach((pair) => {
    const { sheetId } = pair.monthlyRow;

    if (!sheetId) {
      skips.push({
        company: pair.programRow.company,
        keyword: pair.programRow.keyword,
        reason: '월보장 시트에 개별 시트 링크 없음',
      });
      return;
    }

    const existingPairs = groupMap.get(sheetId) ?? [];
    groupMap.set(sheetId, [...existingPairs, pair]);
  });

  return {
    groups: Array.from(groupMap.entries()).map(([sheetId, groupedPairs]) => ({
      sheetId,
      pairs: groupedPairs,
    })),
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
    const sheet = doc.sheetsByTitle[firstPlan.sheetTitle] ?? chooseIndividualSheet(doc);
    const maxColumnIndex = Math.max(
      ...sheetPlans.map(({ targetColumnNumber }) => targetColumnNumber - 1)
    );
    const minColumnIndex = Math.min(
      ...sheetPlans.map(({ targetColumnNumber }) => targetColumnNumber - 1)
    );
    const maxRowIndex = Math.max(
      ...sheetPlans.map(({ targetRowNumber }) => targetRowNumber - 1)
    );

    if (sheet.columnCount <= maxColumnIndex) {
      await sheet.resize({
        rowCount: sheet.rowCount,
        columnCount: maxColumnIndex + 1,
      });
    }

    await sheet.loadCells({
      startRowIndex: 0,
      endRowIndex: maxRowIndex + 1,
      startColumnIndex: minColumnIndex,
      endColumnIndex: maxColumnIndex + 1,
    });

    sheetPlans.forEach((plan) => {
      const columnIndex = plan.targetColumnNumber - 1;
      const rowIndex = plan.targetRowNumber - 1;

      if (plan.shouldCreateDateColumn) {
        sheet.getCell(0, columnIndex).value = plan.dateColumnLabel;
      }

      sheet.getCell(rowIndex, columnIndex).value = plan.nextValue;
    });

    await sheet.saveUpdatedCells();

    logger.success(
      `${firstPlan.spreadsheetTitle} / ${sheet.title}: ${sheetPlans.length}셀 기록 완료`
    );
  }
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const auth = getGoogleSheetAuth();
  const dateColumnLabel = formatKoreanDateLabel(options.date);

  logger.summary.start('ROOT INDIVIDUAL EXPOSURE SYNC', [
    { label: '날짜 컬럼', value: dateColumnLabel },
    { label: '모드', value: options.dryRun ? 'dry-run' : 'write' },
    { label: '대상 제한', value: options.limit > 0 ? `${options.limit}개` : '전체' },
    { label: '동시성', value: `${options.concurrency}` },
  ]);

  const programRows = await loadProgramRootRows(auth, options.limit);
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
    ({ currentValue, nextValue, shouldCreateDateColumn }) =>
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
    ({ currentCumulativeValue, nextCumulativeValue }) =>
      nextCumulativeValue !== '' && currentCumulativeValue !== nextCumulativeValue
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
      logger.info(
        `${plan.company} / ${plan.keyword}: ${plan.spreadsheetTitle} ${plan.sheetTitle}!C${plan.cumulativeColumnNumber} R${plan.targetRowNumber} "${plan.currentCumulativeValue}" -> "${plan.nextCumulativeValue}" (${plan.extensionValue || '연장 빈값'}, ${plan.cumulativeReason})`
      );
    });

    if (changedCumulativePlans.length > 30) {
      logger.info(`...외 ${changedCumulativePlans.length - 30}건`);
    }
  }

  logger.divider('스킵 샘플');
  skips.slice(0, 20).forEach((skip) => {
    logger.warn(`${skip.company} / ${skip.keyword}: ${skip.reason}`);
  });

  if (skips.length > 20) {
    logger.warn(`...외 ${skips.length - 20}건`);
  }

  logger.summary.complete('ROOT INDIVIDUAL EXPOSURE SYNC COMPLETE', [
    { label: '프로그램 루트 행', value: `${programRows.length}개` },
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
    { label: '스킵', value: `${skips.length}개` },
    { label: '실제 쓰기', value: options.dryRun ? '없음' : '완료' },
  ]);
};

main().catch((error) => {
  logger.error(`루트 개별시트 노출여부 동기화 실패: ${(error as Error).message}`);
  process.exit(1);
});
