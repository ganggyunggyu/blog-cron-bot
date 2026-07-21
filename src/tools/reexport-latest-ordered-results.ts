import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseCsv, type SheetCellValue } from '../lib/csv-output';
import {
  ORDERED_RESULT_TARGETS,
  OrderedResultTarget,
  loadOrderedSourceKeywords,
  rewriteResultSheetRows,
} from '../lib/google-sheets/ordered-result-sheet';
import { logger } from '../lib/logger';

dotenv.config();

const FILE_PREFIXES: Record<OrderedResultTarget, string> = {
  package: 'results-package_sheet_',
  general: 'results-dogmaru-exclude_sheet_',
  dogmaru: 'results-dogmaru_sheet_',
  root: 'root_sheet_',
  suripet: 'pages_sheet_',
};

const NUMERIC_COLUMNS = new Set([3, 6, 11]);

const listFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const targetPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(targetPath) : [targetPath];
  });

const getLatestCsv = (target: OrderedResultTarget): string => {
  const outputDirectory = path.join(process.cwd(), 'output');
  const prefix = FILE_PREFIXES[target];
  const candidates = listFiles(outputDirectory).filter(
    (filePath) =>
      path.basename(filePath).startsWith(prefix) && filePath.endsWith('.csv')
  );

  if (candidates.length === 0) {
    throw new Error(`${target} 결과 CSV를 찾을 수 없음`);
  }

  return candidates.sort(
    (left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs
  )[0];
};

const loadSheetRows = (filePath: string): SheetCellValue[][] => {
  const [, ...rows] = parseCsv(fs.readFileSync(filePath, 'utf8'));
  return rows.map((row) =>
    row.map((value, columnIndex) => {
      if (!value || !NUMERIC_COLUMNS.has(columnIndex)) return value;
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : value;
    })
  );
};

const getExactRowKey = (
  target: OrderedResultTarget,
  company: string,
  keyword: string
): string => {
  const normalizedCompany = company.trim();
  if (target === 'root') {
    const suffix = `(${normalizedCompany})`;
    const normalizedKeyword = keyword.trim().endsWith(suffix)
      ? keyword.trim().slice(0, -suffix.length)
      : keyword.trim();
    return `${normalizedCompany}\u0000${normalizedKeyword}`;
  }
  return keyword.trim();
};

const shiftUnused = (
  queue: SheetCellValue[][] | undefined,
  usedRows: Set<SheetCellValue[]>
): SheetCellValue[] | undefined => {
  while (queue?.length) {
    const row = queue.shift();
    if (row && !usedRows.has(row)) return row;
  }
  return undefined;
};

const reorderRowsFromSource = async (
  target: OrderedResultTarget,
  rows: SheetCellValue[][]
): Promise<SheetCellValue[][]> => {
  const exactQueues = new Map<string, SheetCellValue[][]>();
  const companyQueues = new Map<string, SheetCellValue[][]>();
  rows.forEach((row) => {
    const company = String(row[0] ?? '');
    const key = getExactRowKey(
      target,
      company,
      String(row[1] ?? '')
    );
    const exactQueue = exactQueues.get(key) ?? [];
    exactQueue.push(row);
    exactQueues.set(key, exactQueue);

    if (target === 'root') {
      const companyKey = company.trim();
      const companyQueue = companyQueues.get(companyKey) ?? [];
      companyQueue.push(row);
      companyQueues.set(companyKey, companyQueue);
    }
  });

  const sourceKeywords = await loadOrderedSourceKeywords(target);
  const usedRows = new Set<SheetCellValue[]>();
  const orderedRows = sourceKeywords.flatMap(({ company, keyword }) => {
    const exactKey = getExactRowKey(target, company, keyword);
    const row =
      shiftUnused(exactQueues.get(exactKey), usedRows) ??
      (target === 'root'
        ? shiftUnused(companyQueues.get(company.trim()), usedRows)
        : undefined);
    if (!row) return [];

    usedRows.add(row);
    const orderedRow = [...row];
    orderedRow[11] = usedRows.size;
    return [orderedRow];
  });

  const remainingCount = rows.length - usedRows.size;
  if (remainingCount > 0 && target !== 'suripet') {
    throw new Error(`${target} 원본에서 찾지 못한 완료 결과 ${remainingCount}개`);
  }

  return orderedRows;
};

const parseTargets = (): OrderedResultTarget[] => {
  const rawTargets = process.argv
    .find((argument) => argument.startsWith('--targets='))
    ?.slice('--targets='.length);
  if (!rawTargets) return [...ORDERED_RESULT_TARGETS];

  const targets = rawTargets.split(',').map((value) => value.trim());
  const invalid = targets.filter(
    (target) => !ORDERED_RESULT_TARGETS.includes(target as OrderedResultTarget)
  );
  if (invalid.length > 0) throw new Error(`지원하지 않는 대상: ${invalid.join(', ')}`);
  return targets as OrderedResultTarget[];
};

const main = async (): Promise<void> => {
  const targets = parseTargets();
  const results = await Promise.all(
    targets.map(async (target) => {
      const filePath = getLatestCsv(target);
      const rows = await reorderRowsFromSource(target, loadSheetRows(filePath));
      const rewrite = await rewriteResultSheetRows(target, rows);
      return { target, filePath, rowCount: rewrite.rowCount };
    })
  );

  results.forEach(({ target, filePath, rowCount }) => {
    logger.success(`${target}: ${rowCount}행 재내보내기 완료 (${filePath})`);
  });
};

main().catch((error) => {
  logger.error(`최신 결과 재내보내기 실패: ${(error as Error).message}`);
  process.exit(1);
});
