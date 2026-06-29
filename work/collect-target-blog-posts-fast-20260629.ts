import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';

interface TargetBlog {
  sheetName: string;
  displayName: string;
  blogId: string;
  accountIds: string[];
}

interface ScheduleRecord {
  _id: string;
  accountId: string;
  service?: string;
  scheduleDate?: string;
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

interface PublicPost {
  rank: number;
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
  matchReason: string;
}

interface SheetRow {
  순위: string;
  글: string;
  링크: string;
  키워드: string;
  발행일: string;
  블로그: string;
  블로그ID: string;
  글번호: string;
  매칭: string;
  비고: string;
}

interface TargetResult {
  sheetName: string;
  displayName: string;
  blogId: string;
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
const HEADERS = [
  '순위',
  '글',
  '링크',
  '키워드',
  '발행일',
  '블로그',
  '블로그ID',
  '글번호',
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
  const match = addDate.trim().match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
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
      await sleep(800 * (attempt + 1));
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
    if (page === 1) total = extractTotalCount(text);
    if (pageItems.length === 0) break;

    for (const item of pageItems) {
      const logNo = String(item.logNo ?? '').trim();
      const title = decodeNaverTitle(item.title);
      if (!logNo || !title) continue;
      const addDate = String(item.addDate ?? '').trim();
      posts.push({
        rank: posts.length + 1,
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
    await sleep(120);
  }

  return posts;
};

const targetByAccountId = new Map<string, TargetBlog>(
  TARGETS.flatMap((target) =>
    target.accountIds.map((accountId) => [accountId.toLowerCase(), target] as const)
  )
);

const resolveTarget = (
  job: DbJob,
  scheduleById: Map<string, ScheduleRecord>
): TargetBlog | null => {
  const schedule = scheduleById.get(job.scheduleId);
  if (schedule?.accountId) {
    const byAccountId = targetByAccountId.get(schedule.accountId.toLowerCase());
    if (byAccountId) return byAccountId;
  }

  const postUrl = String(job.postUrl ?? '').toLowerCase();
  return TARGETS.find((target) => postUrl.includes(target.blogId.toLowerCase())) ?? null;
};

const loadPublishedJobs = async (): Promise<MatchedJob[]> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not ready');

  const accountIds = TARGETS.flatMap((target) => target.accountIds);
  const accountSchedules = await db
    .collection<ScheduleRecord>('schedules')
    .find(
      { accountId: { $in: accountIds } },
      { projection: { _id: 1, accountId: 1, service: 1, scheduleDate: 1 } }
    )
    .toArray();

  const scheduleIds = accountSchedules.map((schedule) => schedule._id);
  const postUrlFilters = TARGETS.map((target) => ({
    postUrl: { $regex: target.blogId, $options: 'i' },
  }));

  const bySchedule = scheduleIds.length
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

  const byPostUrl = await db
    .collection<DbJob>('schedulejobs')
    .find(
      { status: 'published', $or: postUrlFilters },
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
  for (const job of [...bySchedule, ...byPostUrl]) {
    jobById.set(String(job._id), job);
  }

  const allScheduleIds = Array.from(new Set(Array.from(jobById.values()).map((job) => job.scheduleId)));
  const schedules = await db
    .collection<ScheduleRecord>('schedules')
    .find(
      { _id: { $in: allScheduleIds } },
      { projection: { _id: 1, accountId: 1, service: 1, scheduleDate: 1 } }
    )
    .toArray();
  const scheduleById = new Map<string, ScheduleRecord>(
    schedules.map((schedule) => [String(schedule._id), schedule])
  );

  return Array.from(jobById.values())
    .map((job) => {
      const target = resolveTarget(job, scheduleById);
      return target
        ? {
            target,
            job,
            schedule: scheduleById.get(job.scheduleId),
            matchReason: '',
          }
        : null;
    })
    .filter((row): row is MatchedJob => row !== null)
    .sort((left, right) => {
      const leftIndex = TARGETS.findIndex((target) => target.blogId === left.target.blogId);
      const rightIndex = TARGETS.findIndex((target) => target.blogId === right.target.blogId);
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
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
  const candidates = posts
    .filter((post) => normalizeText(post.title).includes(keyword))
    .map((post) => ({
      post,
      used: usedLogNos.has(post.logNo),
      distance: dayDistance(scheduledDate, post.publishedDate),
    }))
    .sort((left, right) => {
      if (left.used !== right.used) return left.used ? 1 : -1;
      if (left.distance !== right.distance) return left.distance - right.distance;
      return left.post.rank - right.post.rank;
    });

  const best = candidates[0]?.post;
  if (!best) return { reason: '공개글 제목에서 키워드 미매칭' };

  usedLogNos.add(best.logNo);
  const distance = dayDistance(scheduledDate, best.publishedDate);
  const distanceLabel =
    distance === Number.MAX_SAFE_INTEGER ? '' : `+날짜근접(${distance}일)`;
  return { post: best, reason: `제목 키워드 매칭${distanceLabel}` };
};

const attachPublicPosts = (
  jobs: MatchedJob[],
  postsByBlogId: Map<string, PublicPost[]>
): MatchedJob[] => {
  const usedByBlogId = new Map<string, Set<string>>();

  return jobs.map((row) => {
    const posts = postsByBlogId.get(row.target.blogId) ?? [];
    const used = usedByBlogId.get(row.target.blogId) ?? new Set<string>();
    usedByBlogId.set(row.target.blogId, used);
    const { post, reason } = choosePublicPost(row.job, posts, used);
    return { ...row, publicPost: post, matchReason: reason };
  });
};

const toSheetRow = (row: MatchedJob): SheetRow => {
  const post = row.publicPost;
  const noteParts = [
    row.schedule?.service ? `service=${row.schedule.service}` : '',
    row.job.category ? `category=${row.job.category}` : '',
    post?.addDate ? `blogAddDate=${post.addDate}` : '',
  ].filter(Boolean);

  return {
    순위: post ? `${post.rank}` : '',
    글: post?.title || '(공개글 매칭 실패)',
    링크: post?.url || row.job.postUrl || '',
    키워드: row.job.keyword,
    발행일: formatKstDateTime(row.job.scheduledAt),
    블로그: row.target.displayName,
    블로그ID: row.target.blogId,
    글번호: post?.logNo || '',
    매칭: row.matchReason,
    비고: noteParts.join(' | '),
  };
};

const escapeCsv = (value: unknown): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const saveCsv = (result: TargetResult, timestamp: string): string => {
  const filePath = path.join(OUTPUT_DIR, `${result.sheetName}_blog_posts_${timestamp}.csv`);
  const lines = [
    HEADERS.join(','),
    ...result.rows.map((row) => HEADERS.map((header) => escapeCsv(row[header])).join(',')),
  ];
  fs.writeFileSync(filePath, `\uFEFF${lines.join('\n')}`);
  return filePath;
};

const run = async (): Promise<void> => {
  const schedulerEnvArgIndex = process.argv.indexOf('--scheduler-env');
  const publicOnly = process.argv.includes('--public-only');
  const schedulerEnv =
    schedulerEnvArgIndex >= 0 && process.argv[schedulerEnvArgIndex + 1]
      ? process.argv[schedulerEnvArgIndex + 1]
      : process.env.SCHEDULER_ENV_PATH || DEFAULT_SCHEDULER_ENV;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    const postsByBlogId = new Map<string, PublicPost[]>();

    for (const target of TARGETS) {
      const posts = await fetchPublicPosts(target);
      postsByBlogId.set(target.blogId, posts);
      console.log(`${target.sheetName}: 공개글 ${posts.length}개`);
    }

    if (publicOnly) {
      const results: TargetResult[] = TARGETS.map((target) => ({
        sheetName: target.sheetName,
        displayName: target.displayName,
        blogId: target.blogId,
        rows: (postsByBlogId.get(target.blogId) ?? []).map((post) => ({
          순위: String(post.rank),
          글: post.title,
          링크: post.url,
          키워드: post.title,
          발행일: post.addDate,
          블로그: target.displayName,
          블로그ID: target.blogId,
          글번호: post.logNo,
          매칭: '공개 블로그 목록',
          비고: post.categoryNo ? `categoryNo=${post.categoryNo}` : '',
        })),
      }));

      const timestamp = new Date()
        .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
        .replace(/[-: ]/g, '')
        .slice(0, 14);
      const csvPaths = results.map((result) => saveCsv(result, timestamp));
      const jsonPath = path.join(OUTPUT_DIR, `target-blog-public-posts-${timestamp}.json`);

      fs.writeFileSync(
        jsonPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            generatedAtKst: formatKstDateTime(new Date()),
            rankingBasis: '각 블로그 공개 글 목록 최신순 순위',
            keywordBasis: '공개 글 제목',
            headers: HEADERS,
            results,
            csvPaths,
            summary: results.map((result) => ({
              sheetName: result.sheetName,
              blogId: result.blogId,
              rows: result.rows.length,
            })),
          },
          null,
          2
        )
      );

      console.log(
        JSON.stringify(
          {
            jsonPath,
            csvPaths,
            summary: results.map((result) => ({
              sheetName: result.sheetName,
              rows: result.rows.length,
            })),
          },
          null,
          2
        )
      );
      return;
    }

    dotenv.config({ path: schedulerEnv });
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30_000,
      socketTimeoutMS: 45_000,
      bufferCommands: false,
    });

    const jobs = await loadPublishedJobs();
    const matchedJobs = attachPublicPosts(jobs, postsByBlogId);
    const results: TargetResult[] = TARGETS.map((target) => ({
      sheetName: target.sheetName,
      displayName: target.displayName,
      blogId: target.blogId,
      rows: matchedJobs
        .filter((row) => row.target.blogId === target.blogId)
        .map(toSheetRow)
        .sort((left, right) => {
          const leftRank = Number(left.순위 || Number.MAX_SAFE_INTEGER);
          const rightRank = Number(right.순위 || Number.MAX_SAFE_INTEGER);
          if (leftRank !== rightRank) return leftRank - rightRank;
          return left.발행일.localeCompare(right.발행일);
        }),
    }));

    const timestamp = new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
      .replace(/[-: ]/g, '')
      .slice(0, 14);
    const csvPaths = results.map((result) => saveCsv(result, timestamp));
    const jsonPath = path.join(OUTPUT_DIR, `target-blog-posts-fast-${timestamp}.json`);

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          generatedAtKst: formatKstDateTime(new Date()),
          rankingBasis: '각 블로그 공개 글 목록 최신순 순위',
          headers: HEADERS,
          results,
          csvPaths,
          summary: results.map((result) => ({
            sheetName: result.sheetName,
            blogId: result.blogId,
            rows: result.rows.length,
            matched: result.rows.filter((row) => row.글번호).length,
            unmatched: result.rows.filter((row) => !row.글번호).length,
          })),
        },
        null,
        2
      )
    );

    console.log(
      JSON.stringify(
        {
          jsonPath,
          csvPaths,
          summary: results.map((result) => ({
            sheetName: result.sheetName,
            rows: result.rows.length,
            matched: result.rows.filter((row) => row.글번호).length,
            unmatched: result.rows.filter((row) => !row.글번호).length,
          })),
        },
        null,
        2
      )
    );
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error((error as Error).stack || (error as Error).message);
    process.exit(1);
  });
}
