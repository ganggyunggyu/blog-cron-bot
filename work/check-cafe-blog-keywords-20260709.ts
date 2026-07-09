import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { crawlWithRetryWithoutCookie, randomDelay } from '../src/crawler';
import { PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS } from '../src/constants/blog-ids';
import {
  CafeTarget,
  buildCafeExposureRow,
  matchCafeTargets,
} from '../src/lib/cafe-exposure-check';
import { fetchCafeArticleInfo } from '../src/lib/cafe-exposure-check/fetch-view-count';
import {
  getGoogleSheetAuth,
  openSpreadsheet,
} from '../src/lib/google-sheets/direct-exposure-sheet';
import { RETRY } from '../src/constants/crawl-config';
import { extractPopularItems } from '../src/parser';
import { matchBlogs } from '../src/matcher';

dotenv.config();

// Fast one-off run: avoid minute-long 403 backoff in this ad hoc batch.
(RETRY as any).DEFAULT_LOGIN_RETRIES = 1;
(RETRY as any).DEFAULT_GUEST_RETRIES = 1;
(RETRY as any).MAX_RETRIES = 1;
(RETRY as any).DELAY_ON_403 = 1000;
(RETRY as any).DELAY_ON_ERROR = 1000;

const SHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const OUTPUT_GID = 1406050962;
const OUTPUT_TITLE = '카페노출체크';

const KEYWORDS = [
  '두유제조기',
  'LDM 디바이스',
  '쿼드쎄라 펜타',
  '알파cd',
  '무지외반증 교정기',
  '거북목교정기',
  '족저근막염깔창',
  '아치깔창',
  '족저근막염 신발',
  '신발깔창',
  '올리브오일',
  '깔창',
  '평발깔창',
  '푸룬주스',
  '장에좋은음식',
  '군대깔창',
  '군화깔창',
  '답례품',
  '회사 답례품',
  '결혼 답례품',
  '삼척카페',
  '강아지 눈 영양제',
  '강아지 영양제',
  '인천웨딩홀',
  '대구 가족사진',
  '부평웨딩홀',
  '위고비 알약',
  '베르가못',
  '마운자로 요요',
  '파운다요',
  '대구사진관',
  '천안내성발톱',
  '아산웨딩홀',
  '천안웨딩홀',
  '수원웨딩홀',
  '강아지 관절 영양제',
  '인천예식장',
  '먹는 위고비',
  '광주웨딩홀',
  '부천웨딩홀',
  '일산웨딩홀',
  '아산카페',
  '신정호카페',
  '광주예식장',
  '의정부웨딩홀',
  '인천웨딩홀추천',
  '시스템에어컨청소업체',
  '청소업체추천',
  '방역업체',
  '에어컨청소업체',
  '인천방역업체',
  '해충방역업체',
  '결혼반지',
  '장바구니캐리어',
  '접이식카트',
  '울산위고비',
  '울산마운자로처방',
  '밀크씨슬',
  '부천pt',
  '드라이기',
  '헤어드라이기',
  '헤어드라이어',
  '드라이기 추천',
  '미용실드라이기',
  '랩다이아몬드',
  '선풍기',
  '날개없는 선풍기',
  '헤어에센스추천',
  '여성청바지',
  '다이아반지',
  '1캐럿다이아반지',
  '웨딩밴드',
  '3부다이아반지',
  '5부다이아반지',
  '프로포즈반지',
  '랩다이아반지',
  '종로예물',
  '예물반지',
  '웨딩링',
  '조문 답례품',
  '음식물처리기',
  '음식물분쇄기',
  'sat학원',
];

const CAFE_TARGETS: CafeTarget[] = [
  { name: '맛집 밥상노트', ids: ['babsangnote702'] },
  { name: '맛집 동네밥상', ids: ['localtable702'] },
  { name: '맛집 메뉴수첩', ids: ['menunote702'] },
  { name: '맛집 식탁모임', ids: ['tableclub702'] },
  { name: '애견 반려수첩', ids: ['petnote702'] },
  { name: '애견 산책노트', ids: ['walknote702'] },
  { name: '건강 생활수첩', ids: ['carelog702'] },
  { name: '건강 습관노트', ids: ['habitnote702'] },
  { name: '생활 정보마당', ids: ['infomadang702'] },
  { name: '일상 소통마당', ids: ['talkmadang702'] },
];

const HEADERS = [
  '키워드',
  '블로그 노출',
  '블로그 순위',
  '블로그 인기주제',
  '블로그 인기글 순위',
  '블로그 링크',
  '블로그 발행일',
  '블로그 매칭제목',
  '카페 노출',
  '카페 순위',
  '카페명',
  '카페 링크',
  '카페 조회수',
  '카페 작성일',
  '비고',
];

type SheetRow = Record<string, string | number>;

const toPositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getLatestOutputPath = (): string | null => {
  const outputDir = path.join(process.cwd(), 'output');
  const files = fs
    .readdirSync(outputDir)
    .filter((file) => file.startsWith('cafe-blog-exposure-check-20260709-'))
    .filter((file) => file.endsWith('.json'))
    .sort();

  const latest = files.at(-1);
  return latest ? path.join(outputDir, latest) : null;
};

const readLatestRows = (): SheetRow[] => {
  const latestPath = getLatestOutputPath();
  if (!latestPath) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(latestPath, 'utf8')) as {
    rows?: SheetRow[];
  };
  return parsed.rows ?? [];
};

const getUniqueKeywords = (keywords: string[]): string[] =>
  Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)));

const collectCafeArticleInfo = async (row: ReturnType<typeof buildCafeExposureRow>) => {
  if (row.exposureStatus !== '노출' || !row.link) {
    return row;
  }

  const links = row.link.split(' | ').filter(Boolean);
  const viewCounts: string[] = [];
  const writeDates: string[] = [];

  for (const link of links) {
    const info = await fetchCafeArticleInfo(link);
    viewCounts.push(info.viewCount);
    writeDates.push(info.writeDate);
    await randomDelay(150, 350);
  }

  row.viewCount = viewCounts.filter(Boolean).join(' | ');
  row.writeDate = writeDates.filter(Boolean).join(' | ');
  return row;
};

const checkKeyword = async (keyword: string) => {
  try {
    const html = await crawlWithRetryWithoutCookie(keyword, 3);
    const items = extractPopularItems(html, { includeCafe: true });
    const blogMatch = matchBlogs(keyword, items, {
      blogIds: PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
    })[0];
    const cafeRow = await collectCafeArticleInfo(
      buildCafeExposureRow(keyword, matchCafeTargets(items, CAFE_TARGETS))
    );

    return {
      키워드: keyword,
      '블로그 노출': blogMatch ? 'o' : '',
      '블로그 순위': blogMatch?.position ?? '',
      '블로그 인기주제': blogMatch?.topicName ?? '',
      '블로그 인기글 순위': blogMatch?.positionWithCafe ?? '',
      '블로그 링크': blogMatch?.postLink ?? '',
      '블로그 발행일': blogMatch?.postPublishedAt ?? '',
      '블로그 매칭제목': blogMatch?.postTitle ?? '',
      '카페 노출': cafeRow.exposureStatus === '노출' ? 'o' : '',
      '카페 순위': cafeRow.exposureStatus === '노출' ? cafeRow.rank : '',
      카페명: cafeRow.exposureStatus === '노출' ? cafeRow.cafeName : '',
      '카페 링크': cafeRow.exposureStatus === '노출' ? cafeRow.link : '',
      '카페 조회수': cafeRow.exposureStatus === '노출' ? cafeRow.viewCount : '',
      '카페 작성일': cafeRow.exposureStatus === '노출' ? cafeRow.writeDate : '',
      비고: '',
    };
  } catch (error) {
    return {
      키워드: keyword,
      '블로그 노출': '',
      '블로그 순위': '',
      '블로그 인기주제': '',
      '블로그 인기글 순위': '',
      '블로그 링크': '',
      '블로그 발행일': '',
      '블로그 매칭제목': '',
      '카페 노출': '',
      '카페 순위': '',
      카페명: '',
      '카페 링크': '',
      '카페 조회수': '',
      '카페 작성일': '',
      비고: `확인실패: ${(error as Error).message}`,
    };
  }
};

const createSheetRows = async (keywords: string[]) => {
  const rows = new Array<SheetRow>(keywords.length);
  let nextIndex = 0;
  const workerCount = Math.min(
    toPositiveInteger(process.env.CHECK_CONCURRENCY, 4),
    keywords.length
  );

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= keywords.length) {
        return;
      }

      const keyword = keywords[index];
      process.stdout.write(
        `[check ${index + 1}/${keywords.length}] ${keyword}\n`
      );

      rows[index] = await checkKeyword(keyword);
      await randomDelay(400, 900);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return rows;
};

const writeSheet = async (rows: Record<string, string | number>[]) => {
  const doc = await openSpreadsheet(SHEET_ID, getGoogleSheetAuth());
  const sheet = doc.sheetsById[OUTPUT_GID] ?? doc.sheetsByTitle[OUTPUT_TITLE];

  if (!sheet) {
    throw new Error(`${OUTPUT_TITLE} 탭을 찾을 수 없음`);
  }

  await sheet.clear();
  await sheet.resize({
    rowCount: Math.max(rows.length + 20, 1000),
    columnCount: HEADERS.length,
  });
  await sheet.setHeaderRow(HEADERS);

  if (rows.length > 0) {
    await sheet.addRows(rows);
  }
};

const main = async (): Promise<void> => {
  const checkedAt = new Date().toISOString();
  const allKeywords = getUniqueKeywords(KEYWORDS);
  const previousRows = process.env.RETRY_FAILED_FROM_LATEST === 'true'
    ? readLatestRows()
    : [];
  const failedKeywords = previousRows
    .filter((row) => String(row.비고 ?? '').includes('확인실패'))
    .map((row) => String(row.키워드 ?? '').trim())
    .filter(Boolean);
  const keywords = failedKeywords.length > 0 ? failedKeywords : allKeywords;

  process.stdout.write(
    `keywords: raw=${KEYWORDS.length}, unique=${allKeywords.length}, run=${keywords.length}\n`
  );
  process.stdout.write(
    `blogIds=${PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS.length}, cafeTargets=${CAFE_TARGETS.map((target) => target.name).join(', ')}\n`
  );

  const checkedRows = await createSheetRows(keywords);
  const checkedByKeyword = new Map(
    checkedRows.map((row) => [String(row.키워드 ?? ''), row])
  );
  const sheetRows = previousRows.length > 0
    ? previousRows.map((row) => checkedByKeyword.get(String(row.키워드 ?? '')) ?? row)
    : checkedRows;

  await writeSheet(sheetRows);

  const summary = {
    sheetId: SHEET_ID,
    outputTitle: OUTPUT_TITLE,
    outputGid: OUTPUT_GID,
    checkedAt,
    rawKeywordCount: KEYWORDS.length,
    uniqueKeywordCount: keywords.length,
    blogTargetCount: PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS.length,
    cafeTargets: CAFE_TARGETS.map((target) => target.name),
    blogExposed: sheetRows.filter((row) => row['블로그 노출'] === 'o').length,
    cafeExposed: sheetRows.filter((row) => row['카페 노출'] === 'o').length,
    failed: sheetRows.filter((row) => String(row.비고 ?? '').includes('확인실패'))
      .length,
  };

  const outputPath = path.join(
    process.cwd(),
    'output',
    `cafe-blog-exposure-check-20260709-${checkedAt.replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify({ summary, rows: sheetRows }, null, 2)}\n`
  );

  process.stdout.write(`${outputPath}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
