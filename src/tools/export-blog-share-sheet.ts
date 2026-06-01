import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { TEST_CONFIG } from '../constants';
import {
  getGoogleSheetAuth,
  openSpreadsheet,
} from '../lib/google-sheets/direct-exposure-sheet';
import { logger } from '../lib/logger';

dotenv.config();

interface ExportOptions {
  csvPath: string;
  sheetId: string;
  tabName: string;
}

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const readCsv = (csvPath: string): string[][] => {
  const resolved = path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`CSV 파일을 찾을 수 없음: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
};

const parseArgs = (): ExportOptions => {
  const args = process.argv.slice(2);
  let csvPath = process.env.BLOG_SHARE_EXPORT_CSV ?? '';
  let sheetId = process.env.BLOG_SHARE_EXPORT_SHEET_ID ?? TEST_CONFIG.SHEET_ID;
  let tabName = process.env.BLOG_SHARE_EXPORT_TAB ?? '블로그점유';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if ((arg === '--csv' || arg === '-c') && next) {
      csvPath = next;
      index += 1;
      continue;
    }

    if (arg === '--sheet-id' && next) {
      sheetId = next;
      index += 1;
      continue;
    }

    if ((arg === '--tab' || arg === '-t') && next) {
      tabName = next;
      index += 1;
    }
  }

  if (!csvPath) {
    throw new Error('--csv <path> 옵션이 필요함');
  }

  return {
    csvPath,
    sheetId,
    tabName,
  };
};

const getUniqueTabName = (baseName: string, existingTitles: Set<string>): string => {
  if (!existingTitles.has(baseName)) {
    return baseName;
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseName}_${index}`;
    if (!existingTitles.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`사용 가능한 탭 이름을 찾지 못함: ${baseName}`);
};

const exportCsvToNewTab = async (options: ExportOptions): Promise<void> => {
  const rows = readCsv(options.csvPath);
  if (rows.length === 0) {
    throw new Error('CSV 행이 비어 있음');
  }

  const [header, ...bodyRows] = rows;
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(options.sheetId, auth);
  const existingTitles = new Set(Object.keys(doc.sheetsByTitle));
  const tabName = getUniqueTabName(options.tabName, existingTitles);

  const sheet = await doc.addSheet({
    title: tabName,
    headerValues: header,
    gridProperties: {
      rowCount: Math.max(rows.length + 10, 20),
      columnCount: header.length,
      frozenRowCount: 1,
    },
  });

  if (bodyRows.length > 0) {
    await sheet.addRows(bodyRows);
  }

  logger.summary.complete('블로그 점유 시트 내보내기 완료', [
    { label: '문서', value: doc.title },
    { label: '탭', value: tabName },
    { label: '행', value: `${rows.length}개` },
    { label: '시트ID', value: options.sheetId },
  ]);
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  await exportCsvToNewTab(options);
};

if (require.main === module) {
  main().catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
