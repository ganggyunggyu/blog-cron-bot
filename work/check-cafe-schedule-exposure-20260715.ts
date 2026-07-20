import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { JWT } from 'google-auth-library';
import { crawlWithRetryWithoutCookie, randomDelay } from '../src/crawler';
import {
  CafeMatch,
  CafeTarget,
  matchCafeTargets,
} from '../src/lib/cafe-exposure-check';
import { extractPopularItems } from '../src/parser';
import { matchBlogs } from '../src/matcher';
import { BLOG_IDS } from '../src/constants/blog-ids';
import { emitExposureProgress } from '../src/lib/exposure-progress';

dotenv.config();

const SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';
const SHEET_TITLE = '카페 발행스케줄';
// 카페 + 블로그(우리 블로그 전부) 둘 중 하나라도 노출되면 "노출"로 판정한다.
const RETRY_FAILED_ONLY = process.env.RETRY_FAILED_ONLY === 'true';

interface ScheduleKeyword {
  rowIndex: number;
  keyword: string;
}

interface CheckResult {
  exposureStatus: '노출' | '미노출' | '확인실패';
  rank: string;
  name: string;
  links: string;
  note: string;
}

interface CombinedMatch {
  rank: number;
  name: string;
  link: string;
}

interface SavedResultRow extends CheckResult {
  row: number;
  keyword: string;
}

interface SavedResultArtifact {
  rows: SavedResultRow[];
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
};

const loadSourceValues = async (): Promise<unknown[][]> => {
  const range = encodeURIComponent(`'${SHEET_TITLE}'!A:P`);
  const response = await getAuth().request<{ values?: unknown[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    method: 'GET',
  });
  return response.data.values ?? [];
};

const sourceIdFromCafeUrl = (cafeUrl: string): string => {
  const match = cafeUrl.match(/cafe\.naver\.com\/([^/?#]+)/i);
  return match?.[1]?.trim() ?? '';
};

const unique = (values: string[]): string[] =>
  Array.from(new Set(values.filter((value) => value.length > 0)));

const loadLatestResultArtifact = (): SavedResultArtifact => {
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

  const parsed = JSON.parse(
    fs.readFileSync(path.join(outputDir, latest), 'utf8')
  ) as SavedResultArtifact;
  if (!Array.isArray(parsed.rows)) {
    throw new Error(`카페 노출체크 결과 형식이 올바르지 않음: ${latest}`);
  }
  return parsed;
};

const loadSchedule = async (
  values: unknown[][]
): Promise<{ title: string; rows: ScheduleKeyword[]; targets: CafeTarget[] }> => {
  const markerRowIndex = values.findIndex((row) =>
    /스케[줄쥴]/.test(cellText(row?.[0]))
  );

  if (markerRowIndex < 0) {
    throw new Error('A열에서 스케줄 제목을 찾지 못함');
  }

  const title = cellText(values[markerRowIndex]?.[0]);
  const rows: ScheduleKeyword[] = [];
  for (let rowIndex = markerRowIndex + 1; rowIndex < values.length; rowIndex += 1) {
    const keyword = cellText(values[rowIndex]?.[0]);
    if (/스케[줄쥴]/.test(keyword)) break;
    if (keyword) rows.push({ rowIndex, keyword });
  }

  const targets: CafeTarget[] = [];
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const name = cellText(values[rowIndex]?.[14]);
    const sourceId = sourceIdFromCafeUrl(cellText(values[rowIndex]?.[15]));
    if (name && sourceId) targets.push({ name, ids: [sourceId] });
  }

  if (targets.length === 0) {
    targets.push(
      { name: '일상 소통마당', ids: ['talkmadang702'] },
      { name: '가중건다', ids: ['healthhhh'] },
      { name: '운연정', ids: ['driveee'] },
      { name: '육아 돌봄수첩', ids: ['ahffkdlek12'] },
      { name: '맛집 동네밥상', ids: ['localtable702'] },
      { name: '맛집 메뉴수첩', ids: ['menunote702'] },
      { name: '맛집 식탁모임', ids: ['tableclub702'] },
      { name: '애견 반려정보', ids: ['petinfo183'] },
      { name: '애견 산책이야기', ids: ['dogwalk2m4'] },
      { name: '건강 생활수첩', ids: ['carelog702'] },
      { name: '건강 습관노트', ids: ['habitnote702'] },
      { name: '생활 정보마당', ids: ['infomadang702'] },
    );
  }

  if (rows.length === 0 || targets.length === 0) {
    throw new Error(`스케줄 키워드 ${rows.length}개, 카페 소스 ${targets.length}개로 실행 불가`);
  }

  return { title, rows, targets };
};

const toResult = (cafeMatches: CafeMatch[], blogMatches: ReturnType<typeof matchBlogs>): CheckResult => {
  const combined: CombinedMatch[] = [
    ...cafeMatches.map((match) => ({ rank: match.cafeRank, name: match.targetName, link: match.link })),
    ...blogMatches.map((match) => ({
      rank: match.position,
      name: match.blogName || match.blogId,
      link: match.postLink,
    })),
  ].sort((a, b) => a.rank - b.rank);

  if (combined.length === 0) {
    return { exposureStatus: '미노출', rank: '', name: '', links: '', note: '' };
  }

  return {
    exposureStatus: '노출',
    rank: combined.map((match) => String(match.rank)).join(' | '),
    name: unique(combined.map((match) => match.name)).join(' | '),
    links: unique(combined.map((match) => match.link)).join(' | '),
    note: '',
  };
};

const checkKeyword = async (keyword: string, targets: CafeTarget[]): Promise<CheckResult> => {
  try {
    const html = await crawlWithRetryWithoutCookie(keyword, 1);
    const items = extractPopularItems(html, { includeCafe: true });
    const cafeMatches = matchCafeTargets(items, targets);
    const blogMatches = matchBlogs(keyword, items, { blogIds: BLOG_IDS });
    return toResult(cafeMatches, blogMatches);
  } catch (error) {
    return {
      exposureStatus: '확인실패',
      rank: '',
      name: '',
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
  let completedCount = 0;
  const configuredWorkers = Number(
    process.env.CHECK_CONCURRENCY ??
      process.env.CAFE_CHECK_CONCURRENCY ??
      process.env.EXPOSURE_CONCURRENCY ??
      3
  );
  const workerCount = Math.min(
    Number.isInteger(configuredWorkers) && configuredWorkers > 0
      ? Math.min(configuredWorkers, 8)
      : 3,
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
      completedCount += 1;
      // The failed-only pass is appended to the same dashboard run. Emitting a
      // smaller retry total here would replace the completed full-run progress.
      if (!RETRY_FAILED_ONLY) {
        emitExposureProgress('cafe', completedCount, keywords.length, 'running');
      }
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

const main = async (): Promise<void> => {
  const sourceValues = await loadSourceValues();
  const { title, rows, targets } = await loadSchedule(sourceValues);
  const retryArtifact = RETRY_FAILED_ONLY ? loadLatestResultArtifact() : null;
  const retryKeywords = retryArtifact
    ? new Set(
        retryArtifact.rows
          .filter((row) => row.exposureStatus === '확인실패')
          .map((row) => row.keyword)
      )
    : null;
  const targetRows = retryKeywords
    ? rows.filter((row) => retryKeywords.has(row.keyword))
    : rows;
  const keywords = unique(targetRows.map((row) => row.keyword));
  if (keywords.length === 0) {
    process.stdout.write('재시도할 확인실패 키워드가 없음\n');
    return;
  }
  const checkedAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', ' ');
  process.stdout.write(
    `${title}: scheduleRows=${targetRows.length}, uniqueKeywords=${keywords.length}, cafeSources=${targets.length}\n`
  );

  const results = await runChecks(keywords, targets);

  const checkedRows: SavedResultRow[] = targetRows.map((row) => {
    const result = results.get(row.keyword);
    if (!result) throw new Error(`${row.keyword} 결과 누락`);
    return {
      row: row.rowIndex + 1,
      keyword: row.keyword,
      ...result,
    };
  });
  const checkedRowMap = new Map(checkedRows.map((row) => [row.row, row]));
  const outputRows = retryArtifact
    ? retryArtifact.rows.map((row) => checkedRowMap.get(row.row) ?? row)
    : checkedRows;
  const summary = {
    spreadsheetId: SHEET_ID,
    sheetTitle: title,
    sourceTab: SHEET_TITLE,
    checkedAt,
    scheduleRows: outputRows.length,
    uniqueKeywords: unique(outputRows.map((row) => row.keyword)).length,
    retryFailedOnly: RETRY_FAILED_ONLY,
    sourceWrite: false,
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
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ summary, rows: outputRows }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ summary, outputPath }, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
