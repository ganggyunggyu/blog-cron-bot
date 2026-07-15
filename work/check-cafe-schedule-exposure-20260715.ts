import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { crawlWithRetryWithoutCookie, randomDelay } from '../src/crawler';
import {
  buildCafeExposureRow,
  CafeMatch,
  CafeTarget,
  matchCafeTargets,
} from '../src/lib/cafe-exposure-check';
import { extractPopularItems } from '../src/parser';

dotenv.config();

const SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';
const SHEET_GID = 126285763;
const OUTPUT_START_COLUMN = 16; // Q
const OUTPUT_HEADERS = [
  '노출체크일시',
  '카페노출',
  '카페순위',
  '카페명',
  '카페소스ID',
  '카페링크',
  '비고',
];
const RETRY_FAILED_ONLY = process.env.RETRY_FAILED_ONLY === 'true';

interface ScheduleKeyword {
  rowIndex: number;
  keyword: string;
}

interface CheckResult {
  exposureStatus: '노출' | '미노출' | '확인실패';
  rank: string;
  cafeName: string;
  sourceIds: string;
  links: string;
  note: string;
}

const cellText = (value: unknown): string => String(value ?? '').trim();

const getAuth = (): JWT => {
  const email = cellText(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const key = cellText(process.env.GOOGLE_PRIVATE_KEY)
    .replace(/\\\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\+$/, '');

  if (!email || !key) {
    throw new Error('Google Sheets 서비스 계정 환경변수가 없음');
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const openSpreadsheet = async (sheetId: string): Promise<GoogleSpreadsheet> => {
  const doc = new GoogleSpreadsheet(sheetId, getAuth());
  await doc.loadInfo();
  return doc;
};

const sourceIdFromCafeUrl = (cafeUrl: string): string => {
  const match = cafeUrl.match(/cafe\.naver\.com\/([^/?#]+)/i);
  return match?.[1]?.trim() ?? '';
};

const unique = (values: string[]): string[] =>
  Array.from(new Set(values.filter((value) => value.length > 0)));

const loadLatestFailedKeywords = (): Set<string> => {
  const outputDir = path.join(process.cwd(), 'outputs');
  const latest = fs
    .readdirSync(outputDir)
    .filter((file) => file.startsWith('cafe-schedule-exposure-'))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .at(-1);

  if (!latest) {
    throw new Error('재시도할 카페 노출체크 결과 파일이 없음');
  }

  const parsed = JSON.parse(fs.readFileSync(path.join(outputDir, latest), 'utf8')) as {
    rows?: Array<{ keyword?: string; exposureStatus?: string }>;
  };
  return new Set(
    (parsed.rows ?? [])
      .filter((row) => row.exposureStatus === '확인실패')
      .map((row) => cellText(row.keyword))
      .filter(Boolean)
  );
};

const loadSchedule = async (
  sheet: GoogleSpreadsheetWorksheet
): Promise<{ title: string; rows: ScheduleKeyword[]; targets: CafeTarget[] }> => {
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: 16,
  });

  const markerRowIndex = Array.from({ length: sheet.rowCount }, (_, rowIndex) => rowIndex).find(
    (rowIndex) => /스케[줄쥴]/.test(cellText(sheet.getCell(rowIndex, 0).value))
  );

  if (markerRowIndex === undefined) {
    throw new Error('A열에서 스케줄 제목을 찾지 못함');
  }

  const title = cellText(sheet.getCell(markerRowIndex, 0).value);
  const rows: ScheduleKeyword[] = [];
  for (let rowIndex = markerRowIndex + 1; rowIndex < sheet.rowCount; rowIndex += 1) {
    const keyword = cellText(sheet.getCell(rowIndex, 0).value);
    if (/스케[줄쥴]/.test(keyword)) break;
    if (keyword) rows.push({ rowIndex, keyword });
  }

  const targets: CafeTarget[] = [];
  for (let rowIndex = 0; rowIndex < sheet.rowCount; rowIndex += 1) {
    const name = cellText(sheet.getCell(rowIndex, 14).value);
    const sourceId = sourceIdFromCafeUrl(cellText(sheet.getCell(rowIndex, 15).value));
    if (name && sourceId) targets.push({ name, ids: [sourceId] });
  }

  if (rows.length === 0 || targets.length === 0) {
    throw new Error(`스케줄 키워드 ${rows.length}개, 카페 소스 ${targets.length}개로 실행 불가`);
  }

  return { title, rows, targets };
};

const toResult = (matches: CafeMatch[]): CheckResult => {
  const row = buildCafeExposureRow('', matches);
  return {
    exposureStatus: row.exposureStatus,
    rank: row.rank,
    cafeName: row.cafeName,
    sourceIds: unique(matches.map((match) => match.sourceId)).join(' | '),
    links: row.link,
    note: '',
  };
};

const checkKeyword = async (keyword: string, targets: CafeTarget[]): Promise<CheckResult> => {
  try {
    const html = await crawlWithRetryWithoutCookie(keyword, 1);
    const items = extractPopularItems(html, { includeCafe: true });
    return toResult(matchCafeTargets(items, targets));
  } catch (error) {
    return {
      exposureStatus: '확인실패',
      rank: '',
      cafeName: '',
      sourceIds: '',
      links: '',
      note: (error as Error).message || 'Unknown error',
    };
  }
};

const runChecks = async (
  keywords: string[],
  targets: CafeTarget[]
): Promise<Map<string, CheckResult>> => {
  const results = new Map<string, CheckResult>();
  let nextIndex = 0;
  const configuredWorkers = Number(process.env.CHECK_CONCURRENCY ?? 3);
  const workerCount = Math.min(
    Number.isInteger(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 3,
    keywords.length
  );

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= keywords.length) return;

      const keyword = keywords[index];
      process.stdout.write(`[${index + 1}/${keywords.length}] ${keyword}\n`);
      results.set(keyword, await checkKeyword(keyword, targets));
      await randomDelay(300, 700);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const failedKeywords = keywords.filter(
    (keyword) => results.get(keyword)?.exposureStatus === '확인실패'
  );
  for (const keyword of failedKeywords) {
    await randomDelay(1100, 1700);
    results.set(keyword, await checkKeyword(keyword, targets));
  }

  return results;
};

const writeResults = async (
  sheet: GoogleSpreadsheetWorksheet,
  scheduleRows: ScheduleKeyword[],
  checkedAt: string,
  results: Map<string, CheckResult>
): Promise<void> => {
  const lastRowIndex = Math.max(...scheduleRows.map((row) => row.rowIndex));
  const requiredColumnCount = OUTPUT_START_COLUMN + OUTPUT_HEADERS.length;
  if (sheet.columnCount < requiredColumnCount) {
    await sheet.resize({ rowCount: sheet.rowCount, columnCount: requiredColumnCount });
  }

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: lastRowIndex + 1,
    startColumnIndex: OUTPUT_START_COLUMN,
    endColumnIndex: requiredColumnCount,
  });

  OUTPUT_HEADERS.forEach((header, offset) => {
    sheet.getCell(0, OUTPUT_START_COLUMN + offset).value = header;
  });

  scheduleRows.forEach(({ rowIndex, keyword }) => {
    const result = results.get(keyword);
    if (!result) throw new Error(`${keyword} 결과 누락`);
    const values = [
      checkedAt,
      result.exposureStatus === '노출' ? 'o' : '',
      result.rank,
      result.cafeName,
      result.sourceIds,
      result.links,
      result.note,
    ];
    values.forEach((value, offset) => {
      sheet.getCell(rowIndex, OUTPUT_START_COLUMN + offset).value = value;
    });
  });

  await sheet.saveUpdatedCells();
};

const main = async (): Promise<void> => {
  const doc = await openSpreadsheet(SHEET_ID);
  const sheet = doc.sheetsById[SHEET_GID];
  if (!sheet) throw new Error(`gid=${SHEET_GID} 탭을 찾지 못함`);

  const { title, rows, targets } = await loadSchedule(sheet);
  const retryKeywords = RETRY_FAILED_ONLY ? loadLatestFailedKeywords() : null;
  const targetRows = retryKeywords
    ? rows.filter((row) => retryKeywords.has(row.keyword))
    : rows;
  const keywords = unique(targetRows.map((row) => row.keyword));
  if (keywords.length === 0) {
    throw new Error('실행할 키워드가 없음');
  }
  const checkedAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', ' ');
  process.stdout.write(
    `${title}: scheduleRows=${targetRows.length}, uniqueKeywords=${keywords.length}, cafeSources=${targets.length}\n`
  );

  const results = await runChecks(keywords, targets);
  await writeResults(sheet, targetRows, checkedAt, results);

  const outputRows = targetRows.map((row) => ({
    row: row.rowIndex + 1,
    keyword: row.keyword,
    ...results.get(row.keyword),
  }));
  const summary = {
    spreadsheetId: SHEET_ID,
    sheetTitle: title,
    sheetGid: SHEET_GID,
    checkedAt,
    scheduleRows: targetRows.length,
    uniqueKeywords: keywords.length,
    retryFailedOnly: RETRY_FAILED_ONLY,
    cafeSources: targets.map((target) => ({ name: target.name, sourceId: target.ids?.[0] })),
    exposed: outputRows.filter((row) => row.exposureStatus === '노출').length,
    unexposed: outputRows.filter((row) => row.exposureStatus === '미노출').length,
    failed: outputRows.filter((row) => row.exposureStatus === '확인실패').length,
  };
  const outputPath = path.join(
    process.cwd(),
    'outputs',
    `cafe-schedule-exposure-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(outputPath, `${JSON.stringify({ summary, rows: outputRows }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ summary, outputPath }, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
