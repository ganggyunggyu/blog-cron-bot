import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { Page } from 'playwright';
import { extractPopularItems, PopularItem } from '../src/parser';
import { buildNaverSearchUrl } from '../src/constants/crawl-config';
import { launchBrowser, closeBrowser } from '../src/lib/playwright-crawler';
import { extractBlogIdFromUrl } from '../src/lib/naver-source';

interface TargetBlog {
  sheetName: string;
  displayName: string;
  blogId: string;
  accountIds: string[];
}

interface DbJob {
  _id: string;
  scheduleId: string;
  keyword: string;
  category?: string;
  scheduledAt: string;
  postUrl?: string;
  completedAt?: Date;
  updatedAt?: Date;
  createdAt?: Date;
}

interface ScheduleRecord {
  _id: string;
  accountId: string;
  service?: string;
  ref?: string;
  scheduleDate?: string;
}

interface PublicPost {
  blogId: string;
  logNo: string;
  title: string;
  url: string;
  addDate: string;
  publishedDate: string;
  categoryNo: string;
}

interface MatchedJob {
  target: TargetBlog;
  job: DbJob;
  schedule?: ScheduleRecord;
  publicPost?: PublicPost;
  publicMatchReason: string;
}

interface SearchItem extends PopularItem {
  page: number;
  pagePosition: number;
}

interface RankMatch {
  status: '노출' | '미노출' | '확인실패';
  rank: string;
  exposureType: string;
  foundTitle: string;
  foundUrl: string;
  matchReason: string;
  error: string;
}

interface SheetRow {
  발행일: string;
  글: string;
  키워드: string;
  순위: string;
  노출여부: string;
  노출구분: string;
  검색노출제목: string;
  글URL: string;
  검색노출URL: string;
  확인범위: string;
  매칭: string;
  비고: string;
}

interface TargetResult {
  sheetName: string;
  displayName: string;
  blogId: string;
  accountIds: string[];
  rows: SheetRow[];
}

const TARGETS: TargetBlog[] = [
  {
    sheetName: '제이제이',
    displayName: '제이제이 (26.06.15 만료)',
    blogId: 'dnation09',
    accountIds: ['dnation09'],
  },
  {
    sheetName: '철인삼남매',
    displayName: '철인삼남매 (25.12.12 만료)',
    blogId: 'dreamclock33',
    accountIds: ['dreamclock33'],
  },
  {
    sheetName: '사랑채마켓',
    displayName: '사랑채마켓 (26.06.30 만료)',
    blogId: 'sarangchai_',
    accountIds: ['snk92789', 'sarangchai_'],
  },
  {
    sheetName: '호이호이',
    displayName: '호이호이 (영구-단체전환)',
    blogId: 'sw078',
    accountIds: ['sw078'],
  },
];

const DEFAULT_SCHEDULER_ENV =
  '/Users/ganggyunggyu/Programing/21lab/blog-bot/scheduler-server/.env';
const OUTPUT_DIR = path.join(__dirname, '../outputs/blog-published-ranks');
const SHEET_HEADERS = [
  '발행일',
  '글',
  '키워드',
  '순위',
  '노출여부',
  '노출구분',
  '검색노출제목',
  '글URL',
  '검색노출URL',
  '확인범위',
  '매칭',
  '비고',
] as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value: string): string =>
  value
    .replace(/\s+/g, '')
    .replace(/[()[\]{}'"`.,:;!?|/_\\-]/g, '')
    .toLowerCase()
    .trim();

const formatKstDateTime = (value: string | Date | undefined): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
};

const formatKstDate = (value: string | Date | undefined): string => {
  const formatted = formatKstDateTime(value);
  return formatted ? formatted.slice(0, 10) : '';
};

const parsePublicAddDate = (addDate: string): string => {
  const normalized = addDate.trim();
  const exact = normalized.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  if (exact) {
    return [
      exact[1],
      exact[2].padStart(2, '0'),
      exact[3].padStart(2, '0'),
    ].join('-');
  }
  return '';
};

const dayDistance = (left: string, right: string): number => {
  if (!left || !right) return Number.MAX_SAFE_INTEGER;
  const leftTime = new Date(`${left}T00:00:00+09:00`).getTime();
  const rightTime = new Date(`${right}T00:00:00+09:00`).getTime();
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.abs(leftTime - rightTime) / 86_400_000;
};

const decodeNaverTitle = (rawValue: unknown): string => {
  const rawTitle = String(rawValue ?? '');
  let decoded = rawTitle;
  try {
    decoded = decodeURIComponent(rawTitle.replace(/\+/g, ' '));
  } catch {
    decoded = rawTitle;
  }
  return decoded
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

const extractJsonArray = (text: string, key: string): Record<string, unknown>[] => {
  const listStart = text.indexOf(`"${key}":[`);
  if (listStart < 0) return [];

  const bracketStart = text.indexOf('[', listStart);
  if (bracketStart < 0) return [];

  let depth = 0;
  let listEnd = -1;
  let inString = false;
  let escape = false;

  for (let index = bracketStart; index < text.length; index += 1) {
    const char = text[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        listEnd = index + 1;
        break;
      }
    }
  }

  if (listEnd < 0) return [];

  try {
    const parsed = JSON.parse(text.slice(bracketStart, listEnd)) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => {
          return !!item && typeof item === 'object';
        })
      : [];
  } catch {
    return [];
  }
};

const extractTotalCount = (text: string): number => {
  const match = text.match(/"totalCount"\s*:\s*"?(\d+)/);
  return match ? Number(match[1]) : 0;
};

const fetchPublicPostPage = async (
  blogId: string,
  page: number,
  attempt = 0
): Promise<string> => {
  const url =
    `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}` +
    `&viewdate=&currentPage=${page}&categoryNo=0&parentCategoryNo=&countPerPage=30`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Referer: `https://blog.naver.com/${blogId}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (attempt < 2) {
      await sleep(1_000 * (attempt + 1));
      return fetchPublicPostPage(blogId, page, attempt + 1);
    }
    throw error;
  }
};

const fetchPublicPosts = async (target: TargetBlog): Promise<PublicPost[]> => {
  const posts: PublicPost[] = [];
  let page = 1;
  let total = 0;

  while (page <= 100) {
    const text = await fetchPublicPostPage(target.blogId, page);
    const pageItems = extractJsonArray(text, 'postList');

    if (page === 1) {
      total = extractTotalCount(text);
    }

    if (pageItems.length === 0) break;

    for (const item of pageItems) {
      const logNo = String(item.logNo ?? '').trim();
      const title = decodeNaverTitle(item.title);
      if (!logNo || !title) continue;

      const addDate = String(item.addDate ?? '').trim();
      posts.push({
        blogId: target.blogId,
        logNo,
        title,
        url: `https://blog.naver.com/${target.blogId}/${logNo}`,
        addDate,
        publishedDate: parsePublicAddDate(addDate),
        categoryNo: String(item.categoryNo ?? '').trim(),
      });
    }

    if (total > 0 && posts.length >= total) break;
    page += 1;
    await sleep(250);
  }

  return posts;
};

const targetByAccountId = new Map<string, TargetBlog>(
  TARGETS.flatMap((target) =>
    target.accountIds.map((accountId) => [accountId.toLowerCase(), target] as const)
  )
);

const targetByBlogId = new Map<string, TargetBlog>(
  TARGETS.map((target) => [target.blogId.toLowerCase(), target])
);

const resolveTargetFromJob = (
  job: DbJob,
  scheduleById: Map<string, ScheduleRecord>
): TargetBlog | null => {
  const schedule = scheduleById.get(job.scheduleId);
  const bySchedule = schedule?.accountId
    ? targetByAccountId.get(schedule.accountId.toLowerCase())
    : undefined;
  if (bySchedule) return bySchedule;

  const postUrl = String(job.postUrl ?? '').toLowerCase();
  for (const target of TARGETS) {
    if (postUrl.includes(target.blogId.toLowerCase())) {
      return target;
    }
  }

  return null;
};

const loadPublishedJobs = async (): Promise<MatchedJob[]> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not ready');

  const allAccountIds = TARGETS.flatMap((target) => target.accountIds);
  const accountSchedules = await db
    .collection<ScheduleRecord>('schedules')
    .find(
      { accountId: { $in: allAccountIds } },
      { projection: { _id: 1, accountId: 1, service: 1, ref: 1, scheduleDate: 1 } }
    )
    .toArray();

  const scheduleIds = accountSchedules.map((schedule) => schedule._id);
  const postUrlFilters = TARGETS.map((target) => ({
    postUrl: { $regex: target.blogId, $options: 'i' },
  }));

  const jobsBySchedule = scheduleIds.length
    ? await db
        .collection<DbJob>('schedulejobs')
        .find(
          { scheduleId: { $in: scheduleIds }, status: 'published' },
          {
            projection: {
              _id: 1,
              scheduleId: 1,
              keyword: 1,
              category: 1,
              scheduledAt: 1,
              postUrl: 1,
              completedAt: 1,
              updatedAt: 1,
              createdAt: 1,
            },
          }
        )
        .toArray()
    : [];

  const jobsByPostUrl = await db
    .collection<DbJob>('schedulejobs')
    .find(
      { $or: postUrlFilters, status: 'published' },
      {
        projection: {
          _id: 1,
          scheduleId: 1,
          keyword: 1,
          category: 1,
          scheduledAt: 1,
          postUrl: 1,
          completedAt: 1,
          updatedAt: 1,
          createdAt: 1,
        },
      }
    )
    .toArray();

  const jobById = new Map<string, DbJob>();
  for (const job of [...jobsBySchedule, ...jobsByPostUrl]) {
    jobById.set(String(job._id), job);
  }

  const allScheduleIds = Array.from(
    new Set(Array.from(jobById.values()).map((job) => job.scheduleId).filter(Boolean))
  );

  const schedules = await db
    .collection<ScheduleRecord>('schedules')
    .find(
      { _id: { $in: allScheduleIds } },
      { projection: { _id: 1, accountId: 1, service: 1, ref: 1, scheduleDate: 1 } }
    )
    .toArray();

  const scheduleById = new Map<string, ScheduleRecord>(
    schedules.map((schedule) => [String(schedule._id), schedule])
  );

  return Array.from(jobById.values())
    .map((job) => {
      const target = resolveTargetFromJob(job, scheduleById);
      if (!target) return null;
      return {
        target,
        job,
        schedule: scheduleById.get(job.scheduleId),
        publicMatchReason: '',
      };
    })
    .filter((row): row is MatchedJob => row !== null)
    .sort((left, right) => {
      const leftTarget = TARGETS.findIndex((target) => target.blogId === left.target.blogId);
      const rightTarget = TARGETS.findIndex((target) => target.blogId === right.target.blogId);
      if (leftTarget !== rightTarget) return leftTarget - rightTarget;
      return left.job.scheduledAt.localeCompare(right.job.scheduledAt);
    });
};

const choosePublicPost = (
  job: DbJob,
  posts: PublicPost[],
  usedLogNos: Set<string>
): { post?: PublicPost; reason: string } => {
  const keyword = normalizeText(job.keyword);
  const scheduledDate = formatKstDate(job.scheduledAt);
  if (!keyword) return { reason: '키워드 없음' };

  const candidates = posts
    .filter((post) => normalizeText(post.title).includes(keyword))
    .map((post) => ({
      post,
      distance: dayDistance(scheduledDate, post.publishedDate),
      used: usedLogNos.has(post.logNo),
    }))
    .sort((left, right) => {
      if (left.used !== right.used) return left.used ? 1 : -1;
      if (left.distance !== right.distance) return left.distance - right.distance;
      return right.post.logNo.localeCompare(left.post.logNo);
    });

  const best = candidates[0]?.post;
  if (!best) {
    return { reason: '공개글 제목에서 키워드 미매칭' };
  }

  usedLogNos.add(best.logNo);
  const distance = dayDistance(scheduledDate, best.publishedDate);
  const reason =
    distance === Number.MAX_SAFE_INTEGER
      ? '제목 키워드 매칭'
      : `제목 키워드+날짜근접(${distance}일)`;
  return { post: best, reason };
};

const attachPublicPosts = (
  rows: MatchedJob[],
  postsByBlogId: Map<string, PublicPost[]>
): MatchedJob[] => {
  const usedByBlogId = new Map<string, Set<string>>();

  return rows.map((row) => {
    const posts = postsByBlogId.get(row.target.blogId) ?? [];
    const usedLogNos = usedByBlogId.get(row.target.blogId) ?? new Set<string>();
    usedByBlogId.set(row.target.blogId, usedLogNos);

    const { post, reason } = choosePublicPost(row.job, posts, usedLogNos);
    return {
      ...row,
      publicPost: post,
      publicMatchReason: reason,
    };
  });
};

const extractLogNoFromUrl = (url: string): string => {
  const candidate = String(url ?? '').trim();
  if (!candidate) return '';

  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    decoded = candidate;
  }

  try {
    const parsed = new URL(decoded);
    const queryLogNo = parsed.searchParams.get('logNo');
    if (queryLogNo) return queryLogNo;
    const pathLogNo = parsed.pathname
      .split('/')
      .map((segment) => segment.trim())
      .find((segment) => /^\d{6,}$/.test(segment));
    if (pathLogNo) return pathLogNo;
  } catch {
    const direct = decoded.match(/(?:logNo=|\/)(\d{6,})(?:[/?&#]|$)/);
    if (direct?.[1]) return direct[1];
  }

  const fallback = decoded.match(/(?:logNo=|\/)(\d{6,})(?:[/?&#]|$)/);
  return fallback?.[1] ?? '';
};

const findRankMatch = (row: MatchedJob, items: SearchItem[]): RankMatch => {
  const targetBlogId = row.target.blogId.toLowerCase();
  const targetLogNo = row.publicPost?.logNo ?? '';
  const keyword = normalizeText(row.job.keyword);

  const sameBlogItems = items.filter((item) => {
    const itemBlogId =
      (item.sourceType === 'blog' ? item.sourceId ?? '' : '') ||
      extractBlogIdFromUrl(item.blogLink || item.link);
    return itemBlogId.toLowerCase() === targetBlogId;
  });

  const exact = targetLogNo
    ? sameBlogItems.find((item) => extractLogNoFromUrl(item.link) === targetLogNo)
    : undefined;
  const fallback = sameBlogItems.find((item) => normalizeText(item.title).includes(keyword));
  const found = exact ?? fallback;

  if (!found) {
    return {
      status: '미노출',
      rank: '',
      exposureType: '',
      foundTitle: '',
      foundUrl: '',
      matchReason: '검색결과 내 대상 블로그/글 미발견',
      error: '',
    };
  }

  const position = found.positionWithCafe ?? found.pagePosition;
  const rank = found.page > 1 ? `${found.page}페이지 ${position}위` : String(position);

  return {
    status: '노출',
    rank,
    exposureType: found.group || '',
    foundTitle: found.title,
    foundUrl: found.link,
    matchReason: exact ? '블로그ID+글번호 일치' : '블로그ID+키워드 제목 일치',
    error: '',
  };
};

const searchKeyword = async (
  page: Page,
  keyword: string,
  maxPages: number
): Promise<SearchItem[]> => {
  const collected: SearchItem[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const url = buildNaverSearchUrl(keyword, pageNumber);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('#main_pack', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(900 + Math.floor(Math.random() * 600));

    const parsed = extractPopularItems(await page.content()).map((item, index) => ({
      ...item,
      page: pageNumber,
      pagePosition: index + 1,
    }));
    collected.push(...parsed);
  }

  return collected;
};

const buildSheetRow = (
  row: MatchedJob,
  rank: RankMatch,
  searchRange: string
): SheetRow => {
  const publicPost = row.publicPost;
  const title = publicPost?.title || '(공개글 매칭 실패)';
  const noteParts = [
    row.schedule?.service ? `service=${row.schedule.service}` : '',
    row.job.category ? `category=${row.job.category}` : '',
    rank.error ? `error=${rank.error}` : '',
  ].filter(Boolean);

  return {
    발행일: formatKstDateTime(row.job.scheduledAt),
    글: title,
    키워드: row.job.keyword,
    순위: rank.rank,
    노출여부: rank.status,
    노출구분: rank.exposureType,
    검색노출제목: rank.foundTitle,
    글URL: publicPost?.url || row.job.postUrl || '',
    검색노출URL: rank.foundUrl,
    확인범위: searchRange,
    매칭: `${row.publicMatchReason} / ${rank.matchReason}`,
    비고: noteParts.join(' | '),
  };
};

const escapeCsv = (value: unknown): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const saveCsv = (result: TargetResult, timestamp: string): string => {
  const filePath = path.join(OUTPUT_DIR, `${result.sheetName}_${timestamp}.csv`);
  const lines = [
    SHEET_HEADERS.join(','),
    ...result.rows.map((row) =>
      SHEET_HEADERS.map((header) => escapeCsv(row[header])).join(',')
    ),
  ];
  fs.writeFileSync(filePath, `\uFEFF${lines.join('\n')}`);
  return filePath;
};

const parseArgs = (): { maxPages: number; schedulerEnv: string } => {
  const args = process.argv.slice(2);
  let maxPages = Number(process.env.SEARCH_MAX_PAGES ?? '2');
  let schedulerEnv = process.env.SCHEDULER_ENV_PATH || DEFAULT_SCHEDULER_ENV;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--max-pages' && next) {
      maxPages = Number(next);
      index += 1;
      continue;
    }

    if (arg === '--scheduler-env' && next) {
      schedulerEnv = next;
      index += 1;
    }
  }

  return {
    maxPages: Number.isFinite(maxPages) && maxPages > 0 ? Math.floor(maxPages) : 2,
    schedulerEnv,
  };
};

const run = async (): Promise<void> => {
  const { maxPages, schedulerEnv } = parseArgs();
  dotenv.config({ path: path.join(__dirname, '../.env') });
  dotenv.config({ path: schedulerEnv, override: false });

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
    bufferCommands: false,
  });

  let outputJsonPath = '';
  const csvPaths: string[] = [];

  try {
    const jobs = await loadPublishedJobs();
    console.log(`published jobs: ${jobs.length}`);

    const postsByBlogId = new Map<string, PublicPost[]>();
    for (const target of TARGETS) {
      const posts = await fetchPublicPosts(target);
      postsByBlogId.set(target.blogId, posts);
      console.log(`${target.sheetName}: public posts ${posts.length}`);
    }

    const matchedJobs = attachPublicPosts(jobs, postsByBlogId);
    const keywordRows = new Map<string, MatchedJob[]>();
    for (const row of matchedJobs) {
      const rows = keywordRows.get(row.job.keyword) ?? [];
      rows.push(row);
      keywordRows.set(row.job.keyword, rows);
    }

    const uniqueKeywords = Array.from(keywordRows.keys());
    const rankByJobId = new Map<string, RankMatch>();
    const context = await launchBrowser();
    const page = await context.newPage();

    try {
      for (let index = 0; index < uniqueKeywords.length; index += 1) {
        const keyword = uniqueKeywords[index];
        process.stdout.write(`\rsearch ${index + 1}/${uniqueKeywords.length}: ${keyword}                    `);

        try {
          const items = await searchKeyword(page, keyword, maxPages);
          for (const row of keywordRows.get(keyword) ?? []) {
            rankByJobId.set(String(row.job._id), findRankMatch(row, items));
          }
          await sleep(700 + Math.floor(Math.random() * 600));
        } catch (error) {
          const message = (error as Error).message;
          for (const row of keywordRows.get(keyword) ?? []) {
            rankByJobId.set(String(row.job._id), {
              status: '확인실패',
              rank: '',
              exposureType: '',
              foundTitle: '',
              foundUrl: '',
              matchReason: '검색 실패',
              error: message,
            });
          }
        }
      }
      process.stdout.write('\n');
    } finally {
      await page.close();
      await closeBrowser();
    }

    const searchRange = `네이버 통합검색 ${maxPages}페이지`;
    const results: TargetResult[] = TARGETS.map((target) => {
      const targetRows = matchedJobs
        .filter((row) => row.target.blogId === target.blogId)
        .map((row) => {
          const rank = rankByJobId.get(String(row.job._id)) ?? {
            status: '확인실패' as const,
            rank: '',
            exposureType: '',
            foundTitle: '',
            foundUrl: '',
            matchReason: '검색 결과 누락',
            error: '',
          };
          return buildSheetRow(row, rank, searchRange);
        });

      return {
        sheetName: target.sheetName,
        displayName: target.displayName,
        blogId: target.blogId,
        accountIds: target.accountIds,
        rows: targetRows,
      };
    });

    const timestamp = new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
      .replace(/[-: ]/g, '')
      .slice(0, 14);

    for (const result of results) {
      csvPaths.push(saveCsv(result, timestamp));
    }

    outputJsonPath = path.join(OUTPUT_DIR, `target-blog-post-ranks-${timestamp}.json`);
    fs.writeFileSync(
      outputJsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          generatedAtKst: formatKstDateTime(new Date()),
          maxPages,
          searchRange,
          headers: SHEET_HEADERS,
          results,
          csvPaths,
        },
        null,
        2
      )
    );

    const summary = results.map((result) => {
      const exposed = result.rows.filter((row) => row.노출여부 === '노출').length;
      const failed = result.rows.filter((row) => row.노출여부 === '확인실패').length;
      return {
        sheetName: result.sheetName,
        blogId: result.blogId,
        rows: result.rows.length,
        exposed,
        unexposed: result.rows.length - exposed - failed,
        failed,
      };
    });

    console.log(JSON.stringify({ outputJsonPath, csvPaths, summary }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error((error as Error).stack || (error as Error).message);
    process.exit(1);
  });
}
