import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { crawlWithRetry, randomDelay } from '../crawler';
import { getKSTTimestamp } from '../utils';
import { extractCafeItems } from '../lib/cafe-exposure-check';
import { logger } from '../lib/logger';

interface PublishedArticleRow {
  cafeId: string;
  cafeName: string;
  cafeUrl: string;
  articleId: number;
  keyword: string;
  title: string;
  articleUrl: string;
  writerAccountId: string;
  postType: string;
  publishedAt: Date;
}

interface CafeSearchItem {
  title: string;
  link: string;
  blogName: string;
  sourceId?: string;
}

interface ExposureRow extends PublishedArticleRow {
  exposureStatus: '노출' | '미노출' | '확인실패';
  rank: string;
  foundTitle: string;
  foundLink: string;
  errorMessage: string;
}

const DEFAULT_CAFE_BOT_ENV = '/Users/ganggyunggyu/Programing/cafe-bot/.env.local';
const OUTPUT_ROOT_DIR = path.join(__dirname, '../../output');

const parseArgs = () => {
  const args = process.argv.slice(2);
  let envPath = process.env.CAFE_BOT_ENV_PATH || DEFAULT_CAFE_BOT_ENV;
  let startKst = '2026-05-30';
  let endKst = '2026-06-01';
  let outputName = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--env' && next) {
      envPath = next;
      index += 1;
      continue;
    }

    if (arg === '--start' && next) {
      startKst = next;
      index += 1;
      continue;
    }

    if (arg === '--end' && next) {
      endKst = next;
      index += 1;
      continue;
    }

    if ((arg === '--output' || arg === '-o') && next) {
      outputName = next;
      index += 1;
    }
  }

  return { envPath, startKst, endKst, outputName };
};

const kstDateToUtc = (date: string): Date => new Date(`${date}T00:00:00+09:00`);

const loadCafeBotEnv = (envPath: string): void => {
  dotenv.config({ path: envPath, override: true });
};

const connectCafeBotDb = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI 환경변수가 없음');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
  });
};

const loadPublishedArticles = async (
  startUtc: Date,
  endUtc: Date
): Promise<PublishedArticleRow[]> => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB 연결 객체가 없음');
  }

  const cafes = await db
    .collection('cafes')
    .find({}, { projection: { _id: 0, cafeId: 1, cafeUrl: 1, name: 1 } })
    .toArray();
  const cafeMap = new Map(
    cafes.map((cafe) => [
      String(cafe.cafeId),
      {
        cafeName: String(cafe.name ?? ''),
        cafeUrl: String(cafe.cafeUrl ?? ''),
      },
    ])
  );

  const articles = await db
    .collection('publishedarticles')
    .find(
      {
        publishedAt: { $gte: startUtc, $lt: endUtc },
        status: { $in: ['published', 'modified'] },
      },
      {
        projection: {
          _id: 0,
          cafeId: 1,
          articleId: 1,
          keyword: 1,
          title: 1,
          articleUrl: 1,
          writerAccountId: 1,
          publishedAt: 1,
          postType: 1,
        },
      }
    )
    .sort({ publishedAt: 1 })
    .toArray();

  return articles.map((article) => {
    const cafeId = String(article.cafeId ?? '');
    const cafe = cafeMap.get(cafeId) ?? { cafeName: '', cafeUrl: '' };

    return {
      cafeId,
      cafeName: cafe.cafeName,
      cafeUrl: cafe.cafeUrl,
      articleId: Number(article.articleId ?? 0),
      keyword: String(article.keyword ?? ''),
      title: String(article.title ?? ''),
      articleUrl: String(article.articleUrl ?? ''),
      writerAccountId: String(article.writerAccountId ?? ''),
      postType: String(article.postType ?? ''),
      publishedAt: new Date(article.publishedAt),
    };
  });
};

const checkArticleExposure = (
  article: PublishedArticleRow,
  items: CafeSearchItem[]
): ExposureRow => {
  const cafeUrl = article.cafeUrl.toLowerCase();
  const cafeName = article.cafeName.replace(/\s+/g, '').toLowerCase();
  const foundIndex = items.findIndex((item) => {
    const itemSourceId = String(item.sourceId ?? '').toLowerCase();
    const itemCafeName = item.blogName.replace(/\s+/g, '').toLowerCase();
    const itemLink = item.link.toLowerCase();

    return (
      (!!cafeUrl &&
        (itemSourceId === cafeUrl || itemLink.includes(`cafe.naver.com/${cafeUrl}`))) ||
      (!!cafeName &&
        (itemCafeName === cafeName ||
          itemCafeName.includes(cafeName) ||
          cafeName.includes(itemCafeName)))
    );
  });
  const found = foundIndex >= 0 ? items[foundIndex] : null;

  return {
    ...article,
    exposureStatus: found ? '노출' : '미노출',
    rank: found ? String(foundIndex + 1) : '',
    foundTitle: found?.title ?? '',
    foundLink: found?.link ?? '',
    errorMessage: '',
  };
};

const getOutputPath = (filename: string): string => {
  const outputDir = path.join(OUTPUT_ROOT_DIR, 'cafe-bot-exposure');
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, filename);
};

const escapeCsv = (value: unknown): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatKst = (date: Date): string =>
  date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });

const saveCsv = (rows: ExposureRow[], filename: string): string => {
  const filePath = getOutputPath(filename);
  const header = [
    '발행일시KST',
    '노출여부',
    '노출순위',
    '키워드',
    '카페명',
    '카페ID',
    '글번호',
    '발행제목',
    '발행링크',
    '검색노출제목',
    '검색노출링크',
    '작성계정',
    '글타입',
    '확인오류',
  ];
  const csvRows = rows.map((row) =>
    [
      escapeCsv(formatKst(row.publishedAt)),
      escapeCsv(row.exposureStatus),
      row.rank,
      escapeCsv(row.keyword),
      escapeCsv(row.cafeName || row.cafeUrl),
      escapeCsv(row.cafeId),
      row.articleId,
      escapeCsv(row.title),
      row.articleUrl,
      escapeCsv(row.foundTitle),
      row.foundLink,
      escapeCsv(row.writerAccountId),
      escapeCsv(row.postType),
      escapeCsv(row.errorMessage),
    ].join(',')
  );

  fs.writeFileSync(filePath, '\uFEFF' + [header.join(','), ...csvRows].join('\n'));
  return filePath;
};

const run = async (): Promise<void> => {
  const { envPath, startKst, endKst, outputName } = parseArgs();
  const startUtc = kstDateToUtc(startKst);
  const endUtc = kstDateToUtc(endKst);

  loadCafeBotEnv(envPath);
  await connectCafeBotDb();

  try {
    const articles = await loadPublishedArticles(startUtc, endUtc);
    logger.info(
      `카페 발행글 노출체크: ${articles.length}건 (${startKst}~${endKst} KST)`
    );

    const keywordCache = new Map<string, CafeSearchItem[]>();
    const errorCache = new Map<string, string>();
    const uniqueKeywords = Array.from(new Set(articles.map((article) => article.keyword)));

    for (let index = 0; index < uniqueKeywords.length; index += 1) {
      const keyword = uniqueKeywords[index];
      logger.statusLine.update(index + 1, uniqueKeywords.length, keyword);

      try {
        const html = await crawlWithRetry(keyword, 5);
        const cafeItems = extractCafeItems(html).map((item) => ({
          title: item.title,
          link: item.link,
          blogName: item.blogName,
          sourceId: item.sourceId,
        }));
        keywordCache.set(keyword, cafeItems);
        await randomDelay(2500, 4500);
      } catch (error) {
        errorCache.set(keyword, (error as Error).message);
      }
    }

    logger.statusLine.done();

    const rows = articles.map((article) => {
      const errorMessage = errorCache.get(article.keyword);
      if (errorMessage) {
        return {
          ...article,
          exposureStatus: '확인실패' as const,
          rank: '',
          foundTitle: '',
          foundLink: '',
          errorMessage,
        };
      }

      return checkArticleExposure(article, keywordCache.get(article.keyword) ?? []);
    });

    const timestamp = getKSTTimestamp();
    const filename = outputName || `cafe_bot_published_exposure_${timestamp}.csv`;
    const csvPath = saveCsv(rows, filename);
    const exposedCount = rows.filter((row) => row.exposureStatus === '노출').length;
    const failedCount = rows.filter((row) => row.exposureStatus === '확인실패').length;

    logger.summary.complete('카페 발행글 노출체크 완료', [
      { label: '대상 글', value: `${rows.length}건` },
      { label: '노출', value: `${exposedCount}건` },
      { label: '미노출', value: `${rows.length - exposedCount - failedCount}건` },
      { label: '확인실패', value: `${failedCount}건` },
      { label: 'CSV', value: csvPath },
    ]);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run().catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
