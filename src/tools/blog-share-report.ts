import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllKeywords,
  getPageCheckKeywords,
  IKeyword,
  IPageCheckKeyword,
  PageCheckSheetType,
} from '../database';
import { createDetailedLogBuilder } from '../logs';
import {
  saveBlogShareDetailCSV,
  saveBlogShareSummaryCSV,
  BlogShareDetailCsvRow,
  BlogShareSummaryCsvRow,
} from '../csv-writer';
import { closeBrowser } from '../lib/playwright-crawler';
import { getCrawlResult } from '../lib/keyword-processor/crawl-manager';
import { getIsNewLogicFromItems } from '../lib/keyword-processor/keyword-classifier';
import {
  CrawlCaches,
  KeywordDoc,
  KeywordType,
  UpdateFunction,
} from '../lib/keyword-processor/types';
import { logger } from '../lib/logger';
import { ExposureResult, matchBlogs } from '../matcher';
import { getKSTTimestamp, getSearchQuery } from '../utils';

dotenv.config();

interface ReportOptions {
  filePath: string;
  sheetTypes: string[];
  outputPrefix: string;
  maxPages: number;
  topLimit: number;
  newLogicOnly: boolean;
}

interface BlogShareBucket {
  blogId: string;
  blogName: string;
  keywords: Set<string>;
  exposureCount: number;
  bestPosition: number;
}

const PAGE_CHECK_SHEET_TYPES: PageCheckSheetType[] = [
  'black-goat-new',
  'black-goat-old',
  'diet-supplement',
  'skin-procedure',
  'prescription',
  'dental',
  'eye-clinic',
  'pet',
  'suripet',
];

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const splitCsv = (value: string | undefined): string[] =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const parseArgs = (args: string[]): ReportOptions => {
  const {
    BLOG_SHARE_FILE,
    BLOG_SHARE_SHEET_TYPES,
    BLOG_SHARE_OUTPUT,
    BLOG_SHARE_PAGES,
    BLOG_SHARE_TOP,
    BLOG_SHARE_NEW_LOGIC_ONLY,
  } = process.env;

  let filePath = BLOG_SHARE_FILE ?? '';
  let sheetTypes = splitCsv(BLOG_SHARE_SHEET_TYPES);
  let outputPrefix = BLOG_SHARE_OUTPUT ?? '';
  let maxPages = parseNumber(BLOG_SHARE_PAGES, 1);
  let topLimit = parseNumber(BLOG_SHARE_TOP, 5);
  let newLogicOnly = BLOG_SHARE_NEW_LOGIC_ONLY === '1';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--file' || arg === '-f') {
      if (next) filePath = next;
      index += 1;
      continue;
    }

    if (arg === '--sheet-types') {
      sheetTypes = splitCsv(next);
      index += 1;
      continue;
    }

    if (arg === '--output' || arg === '-o') {
      if (next) outputPrefix = next;
      index += 1;
      continue;
    }

    if (arg === '--pages' || arg === '-p') {
      maxPages = parseNumber(next, maxPages);
      index += 1;
      continue;
    }

    if (arg === '--top') {
      topLimit = parseNumber(next, topLimit);
      index += 1;
      continue;
    }

    if (arg === '--new-logic-only') {
      newLogicOnly = true;
    }
  }

  if (!filePath && sheetTypes.length === 0) {
    logger.error(
      '키워드 입력이 필요합니다. --file <path> 또는 --sheet-types <type,type> 옵션을 사용하세요.'
    );
    process.exit(1);
  }

  return {
    filePath,
    sheetTypes,
    outputPrefix,
    maxPages,
    topLimit,
    newLogicOnly,
  };
};

const normalizeKeyword = (value: string): string => value.trim();

const parseKeywordsFromJson = (raw: string): string[] => {
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && 'keyword' in entry) {
        return String((entry as { keyword?: string }).keyword ?? '');
      }
      return '';
    })
    .map(normalizeKeyword)
    .filter((keyword) => keyword.length > 0);
};

const parseKeywordsFromLines = (raw: string): string[] => {
  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const rawKeywords = lines
    .map((line) => {
      const [first] = line.split(',');
      return normalizeKeyword(first.replace(/^"|"$/g, ''));
    })
    .filter((keyword) => keyword.length > 0);

  return rawKeywords.filter((keyword) => {
    const normalizedValue = keyword.toLowerCase().replace(/\s+/g, '');
    return normalizedValue !== 'keyword' && normalizedValue !== '키워드';
  });
};

const parseKeywords = (raw: string): string[] => {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      return parseKeywordsFromJson(trimmed);
    } catch (error) {
      logger.error(`JSON 파싱 실패: ${(error as Error).message}`);
      return [];
    }
  }

  return parseKeywordsFromLines(raw);
};

const readKeywordsFromFile = (filePath: string): string[] => {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    logger.error(`키워드 파일을 찾을 수 없습니다: ${resolved}`);
    process.exit(1);
  }

  return parseKeywords(fs.readFileSync(resolved, 'utf8'));
};

const toKeywordDoc = (keyword: string, index: number): KeywordDoc => ({
  _id: `${index + 1}`,
  keyword,
  company: '',
  sheetType: 'blog-share',
});

const isPageCheckSheetType = (
  sheetType: string
): sheetType is PageCheckSheetType =>
  PAGE_CHECK_SHEET_TYPES.includes(sheetType as PageCheckSheetType);

const loadKeywordsFromDb = async (sheetTypes: string[]): Promise<string[]> => {
  const pageCheckTypes = sheetTypes.filter(isPageCheckSheetType);
  const keywordSheetTypes = sheetTypes.filter(
    (sheetType) => !isPageCheckSheetType(sheetType)
  );
  const keywords: string[] = [];

  if (keywordSheetTypes.length > 0) {
    const allKeywords = await getAllKeywords();
    const wanted = new Set(keywordSheetTypes.map((sheetType) => sheetType.toLowerCase()));
    keywords.push(
      ...allKeywords
        .filter((doc: IKeyword) => wanted.has(String(doc.sheetType).toLowerCase()))
        .map((doc: IKeyword) => doc.keyword)
    );
  }

  for (const sheetType of pageCheckTypes) {
    const docs = await getPageCheckKeywords(sheetType);
    keywords.push(...docs.map((doc: IPageCheckKeyword) => doc.keyword));
  }

  return keywords;
};

const dedupeKeywords = (keywords: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    const key = normalized.toLowerCase().replace(/\s+/g, ' ');
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
};

const createCrawlCaches = (): CrawlCaches => ({
  crawlCache: new Map<string, string>(),
  matchQueueMap: new Map<string, ExposureResult[]>(),
  itemsCache: new Map<string, any[]>(),
  htmlStructureCache: new Map<
    string,
    { isPopular: boolean; uniqueGroups: number; topicNames: string[] }
  >(),
  guestAddedLinksCache: new Map<string, Set<string>>(),
  usedLinksCache: new Map<string, Set<string>>(),
});

const aggregateMatches = (
  matches: ExposureResult[],
  summaryMap: Map<string, BlogShareBucket>,
  detailRows: BlogShareDetailCsvRow[]
): void => {
  const seenBlogIdsForKeyword = new Set<string>();

  for (const match of matches) {
    detailRows.push({
      keyword: match.query,
      blogId: match.blogId,
      blogName: match.blogName,
      postTitle: match.postTitle,
      postLink: match.postLink,
      exposureType: match.exposureType,
      topicName: match.topicName,
      position: match.position,
      isNewLogic: match.isNewLogic === true,
    });

    const blogKey = match.blogId.toLowerCase();
    const bucket = summaryMap.get(blogKey) ?? {
      blogId: match.blogId,
      blogName: match.blogName,
      keywords: new Set<string>(),
      exposureCount: 0,
      bestPosition: match.position,
    };

    bucket.exposureCount += 1;
    bucket.bestPosition = Math.min(bucket.bestPosition, match.position);
    if (!seenBlogIdsForKeyword.has(blogKey)) {
      bucket.keywords.add(match.query);
      seenBlogIdsForKeyword.add(blogKey);
    }

    summaryMap.set(blogKey, bucket);
  }
};

const buildSummaryRows = (
  summaryMap: Map<string, BlogShareBucket>,
  topLimit: number
): BlogShareSummaryCsvRow[] =>
  Array.from(summaryMap.values())
    .sort((left, right) => {
      const keywordDiff = right.keywords.size - left.keywords.size;
      if (keywordDiff !== 0) return keywordDiff;

      const exposureDiff = right.exposureCount - left.exposureCount;
      if (exposureDiff !== 0) return exposureDiff;

      return left.bestPosition - right.bestPosition;
    })
    .slice(0, topLimit)
    .map((bucket, index) => ({
      rank: index + 1,
      blogId: bucket.blogId,
      blogName: bucket.blogName,
      keywordCount: bucket.keywords.size,
      exposureCount: bucket.exposureCount,
      bestPosition: bucket.bestPosition,
      keywords: Array.from(bucket.keywords),
    }));

const runReport = async (options: ReportOptions): Promise<void> => {
  const {
    filePath,
    sheetTypes,
    outputPrefix,
    maxPages,
    topLimit,
    newLogicOnly,
  } = options;
  const rawKeywords = filePath ? readKeywordsFromFile(filePath) : [];
  const dbKeywords = sheetTypes.length > 0 ? await loadKeywordsFromDb(sheetTypes) : [];
  const keywords = dedupeKeywords([...rawKeywords, ...dbKeywords]);

  if (keywords.length === 0) {
    logger.warn('대상 키워드가 없습니다. 입력 파일 또는 시트 타입을 확인하세요.');
    return;
  }

  logger.info(`블로그 점유 리포트 시작: ${keywords.length}개 키워드`);
  if (newLogicOnly) {
    logger.info('신로직 검색 결과만 집계합니다.');
  }

  const keywordDocs = keywords.map(toKeywordDoc);
  const logBuilder = createDetailedLogBuilder();
  const caches = createCrawlCaches();
  const keywordType: KeywordType = 'basic';
  const updateFunction: UpdateFunction = async () => undefined;
  const summaryMap = new Map<string, BlogShareBucket>();
  const detailRows: BlogShareDetailCsvRow[] = [];

  for (let index = 0; index < keywordDocs.length; index += 1) {
    const keywordDoc = keywordDocs[index];
    const { keyword } = keywordDoc;
    const searchQuery = getSearchQuery(keyword || '');
    const keywordStartTime = Date.now();

    logger.statusLine.update(index + 1, keywordDocs.length, keyword);

    const crawlResult = await getCrawlResult(
      searchQuery,
      keywordDoc,
      keyword,
      index + 1,
      keywordDocs.length,
      keywordStartTime,
      keywordType,
      caches,
      logBuilder,
      updateFunction,
      maxPages,
      [],
      true
    );

    if (!crawlResult) {
      logger.warn(`크롤링 실패: ${keyword}`);
      continue;
    }

    const { items } = crawlResult;
    const isNewLogic = getIsNewLogicFromItems(items);

    if (newLogicOnly && !isNewLogic) {
      continue;
    }

    const matches = matchBlogs(keyword, items, {
      allowAnyBlog: true,
      blogIds: [],
    });

    aggregateMatches(matches, summaryMap, detailRows);
  }

  logger.statusLine.done();

  const summaryRows = buildSummaryRows(summaryMap, topLimit);
  const timestamp = getKSTTimestamp();
  const prefix = outputPrefix || `blog_share_${timestamp}`;
  const summaryPath = saveBlogShareSummaryCSV(
    summaryRows,
    `${prefix}_summary.csv`
  );
  const detailPath = saveBlogShareDetailCSV(detailRows, `${prefix}_detail.csv`);

  logger.summary.complete('블로그 점유 리포트 완료', [
    { label: '대상 키워드', value: `${keywords.length}개` },
    { label: '집계 블로그', value: `${summaryMap.size}개` },
    { label: '상위 출력', value: `${summaryRows.length}개` },
    { label: '요약 CSV', value: summaryPath },
    { label: '상세 CSV', value: detailPath },
  ]);
};

const main = async (): Promise<void> => {
  const [, , ...args] = process.argv;
  const options = parseArgs(args);
  const needsDb = options.sheetTypes.length > 0;

  try {
    if (needsDb) {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        logger.error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
        process.exit(1);
      }
      await connectDB(mongoUri);
    }

    await runReport(options);
  } finally {
    await closeBrowser();
    if (needsDb) {
      await disconnectDB();
    }
  }
};

if (require.main === module) {
  main().catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
