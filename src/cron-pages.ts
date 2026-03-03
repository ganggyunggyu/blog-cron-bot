import * as dotenv from 'dotenv';
import axios from 'axios';
import {
  connectDB,
  disconnectDB,
  getPageCheckKeywords,
  updatePageCheckKeywordResult,
  IPageCheckKeyword,
  PageCheckSheetType,
} from './database';
import { saveToCSV, saveToSheetCSV } from './csv-writer';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import { closeBrowser } from './lib/playwright-crawler';
import { getKSTTimestamp } from './utils';
import { ExposureResult } from './matcher';
import { sendDoorayExposureResult } from './lib/dooray';
import {
  BLOG_IDS,
  PAGES_BLOG_IDS,
  SURI_PET_BLOG_IDS,
} from './constants/blog-ids';

dotenv.config();

const PAGE_CHECK_API = process.env.PAGE_CHECK_API || 'http://localhost:3000';

const SHEET_TYPES: PageCheckSheetType[] = [
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

const SHEET_TYPE_NAMES: Record<PageCheckSheetType, string> = {
  'black-goat-new': '흑염소 신규',
  'black-goat-old': '흑염소 구',
  'diet-supplement': '다이어트보조제',
  'skin-procedure': '피부시술',
  prescription: '약처방',
  dental: '치과',
  'eye-clinic': '안과',
  pet: '애견',
  suripet: '서리펫',
};

// 시트별 최대 페이지 수 설정 (기본값: 4)
const MAX_PAGES_BY_SHEET: Partial<Record<PageCheckSheetType, number>> = {};

const DEFAULT_MAX_PAGES = 4;

const getMaxPagesForSheet = (sheetType: PageCheckSheetType): number =>
  MAX_PAGES_BY_SHEET[sheetType] ?? DEFAULT_MAX_PAGES;

async function syncAllSheetsAPI(): Promise<number> {
  try {
    const res = await axios.post(`${PAGE_CHECK_API}/api/page-check/import-all`);
    const { stats, totalInserted } = res.data;

    for (const r of stats) {
      logger.success(`  ${r.label}: ${r.inserted}개 동기화`);
    }

    return totalInserted;
  } catch (error) {
    logger.error(`시트 동기화 실패: ${(error as Error).message}`);
    return 0;
  }
}

async function exportSheetAPI(sheetType: PageCheckSheetType): Promise<boolean> {
  try {
    // suripet은 전용 API 사용
    const url =
      sheetType === 'suripet'
        ? `${PAGE_CHECK_API}/api/suripet/export`
        : `${PAGE_CHECK_API}/api/page-check/export`;
    const body = sheetType === 'suripet' ? {} : { sheetType };

    const res = await axios.post(url, body);
    const totalRows = res.data.totalRows ?? res.data.count ?? 0;
    const updatedCells = res.data.updatedCells ?? '';
    logger.success(
      `  ${SHEET_TYPE_NAMES[sheetType]}: ${totalRows}개 내보내기${updatedCells ? ` (${updatedCells}셀)` : ''}`
    );
    return true;
  } catch (error) {
    logger.error(
      `  ${SHEET_TYPE_NAMES[sheetType]} 내보내기 실패: ${(error as Error).message}`
    );
    return false;
  }
}

async function getSuripetKeywordsAPI(): Promise<IPageCheckKeyword[]> {
  try {
    const res = await axios.get(`${PAGE_CHECK_API}/api/suripet`);
    const data = res.data.data ?? res.data.keywords ?? res.data ?? [];
    // company 필드 추가 (없으면 '서리펫'으로 기본값)
    return data.map((item: any) => ({
      ...item,
      company: item.company ?? '서리펫',
    }));
  } catch (error) {
    logger.error(`서리펫 키워드 조회 실패: ${(error as Error).message}`);
    return [];
  }
}

async function importSheetAPI(sheetType: PageCheckSheetType): Promise<number> {
  try {
    // suripet은 전용 API 사용
    const url =
      sheetType === 'suripet'
        ? `${PAGE_CHECK_API}/api/suripet`
        : `${PAGE_CHECK_API}/api/page-check/import`;
    const body = sheetType === 'suripet' ? {} : { sheetType };

    const res = await axios.post(url, body);
    const inserted = res.data.inserted ?? res.data.count ?? 0;
    logger.success(`  ${SHEET_TYPE_NAMES[sheetType]}: ${inserted}개 동기화`);
    return inserted;
  } catch (error) {
    logger.error(
      `  ${SHEET_TYPE_NAMES[sheetType]} 불러오기 실패: ${(error as Error).message}`
    );
    return 0;
  }
}

function createUpdateFunction(sheetType: PageCheckSheetType) {
  return async (
    keywordId: string,
    visibility: boolean,
    popularTopic: string,
    url: string,
    keywordType: 'restaurant' | 'pet' | 'basic',
    restaurantName?: string,
    matchedTitle?: string,
    rank?: number,
    postVendorName?: string,
    rankWithCafe?: number,
    isUpdateRequired?: boolean,
    isNewLogic?: boolean,
    foundPage?: number
  ) => {
    await updatePageCheckKeywordResult(
      sheetType,
      keywordId,
      visibility,
      popularTopic,
      url,
      keywordType,
      restaurantName,
      matchedTitle,
      rank,
      postVendorName,
      rankWithCafe,
      isUpdateRequired,
      isNewLogic,
      foundPage
    );
  };
}

async function processSheetKeywords(
  sheetType: PageCheckSheetType,
  keywords: IPageCheckKeyword[],
  isLoggedIn: boolean
): Promise<ExposureResult[]> {
  const typeName = SHEET_TYPE_NAMES[sheetType];
  const maxPages = getMaxPagesForSheet(sheetType);
  const logBuilder = createDetailedLogBuilder();

  // 시트별 노출체크 대상 블로그 ID 분기(suripet은 SURI_PET_BLOG_IDS만 사용)
  const getBlogIds = () => {
    if (sheetType === 'suripet') return SURI_PET_BLOG_IDS;
    if (sheetType === 'pet') return BLOG_IDS;
    return BLOG_IDS;
  };
  const blogIds = getBlogIds();

  logger.info(
    `[${typeName}] 🚀 ${keywords.length}개 키워드 처리 시작 (${maxPages}페이지)`
  );

  const results = await processKeywords(keywords as any, logBuilder, {
    updateFunction: createUpdateFunction(sheetType),
    isLoggedIn,
    maxPages,
    blogIds,
  });

  logger.success(`[${typeName}] ✅ 완료: ${results.length}개 노출 발견`);

  // 완료 즉시 시트 내보내기
  await exportSheetAPI(sheetType);

  return results;
}

export async function main(targetSheetTypes?: PageCheckSheetType[]) {
  const startTime = Date.now();
  const activeSheetTypes = targetSheetTypes ?? SHEET_TYPES;
  const isSingleSheet = activeSheetTypes.length === 1;
  const sheetLabel = isSingleSheet
    ? SHEET_TYPE_NAMES[activeSheetTypes[0]]
    : '전체';

  logger.divider(`📄 멀티페이지 크론 [${sheetLabel}]`);

  // 로그인/비로그인 모드는 결과 비교용 실행 모드 구분임(대상 계정 목록 기준은 별도 blogIds 설정 사용)
  const loginStatus = await checkNaverLogin();
  logger.divider('로그인 상태');
  if (loginStatus.isLoggedIn) {
    logger.success(
      `🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`
    );
  } else {
    logger.info('🌐 비로그인 모드');
  }
  logger.blank();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 1. 시트 → DB 동기화 (외부 API)
  logger.divider('시트 동기화');
  if (isSingleSheet) {
    const synced = await importSheetAPI(activeSheetTypes[0]);
    logger.info(`📥 ${synced}개 키워드 동기화 완료`);
  } else {
    const totalSynced = await syncAllSheetsAPI();
    logger.info(`📥 총 ${totalSynced}개 키워드 동기화 완료`);
  }
  logger.blank();

  // 2. DB 연결 및 키워드 조회
  await connectDB(mongoUri);

  const keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]> = {
    'black-goat-new': [],
    'black-goat-old': [],
    'diet-supplement': [],
    'skin-procedure': [],
    prescription: [],
    dental: [],
    'eye-clinic': [],
    pet: [],
    suripet: [],
  };

  logger.divider('키워드 조회');
  for (const sheetType of activeSheetTypes) {
    // suripet은 API로 키워드 조회
    const keywords =
      sheetType === 'suripet'
        ? await getSuripetKeywordsAPI()
        : await getPageCheckKeywords(sheetType);
    keywordsBySheet[sheetType] = keywords;
    logger.info(`  ${SHEET_TYPE_NAMES[sheetType]}: ${keywords.length}개`);
  }

  const totalKeywords = Object.values(keywordsBySheet).reduce(
    (sum, kws) => sum + kws.length,
    0
  );
  logger.info(`📋 총 ${totalKeywords}개 키워드 로드 완료`);
  logger.blank();

  if (totalKeywords === 0) {
    logger.warn('처리할 키워드가 없습니다.');
    await disconnectDB();
    return;
  }

  // 3. 시트 병렬 노출체크
  logger.divider(`노출체크 시작 (${activeSheetTypes.length}개 시트 병렬)`);

  const crawlPromises = activeSheetTypes
    .filter((st) => keywordsBySheet[st].length > 0)
    .map((sheetType) =>
      processSheetKeywords(
        sheetType,
        keywordsBySheet[sheetType],
        loginStatus.isLoggedIn
      )
    );

  const resultsArray = await Promise.all(crawlPromises);
  const allResults = resultsArray.flat();

  logger.blank();

  // 4. CSV 저장
  const timestamp = getKSTTimestamp();
  const filename = `pages_${timestamp}.csv`;
  saveToCSV(allResults, filename);

  const flatKeywords = Object.values(keywordsBySheet).flat();
  saveToSheetCSV(
    flatKeywords.map((k) => ({ keyword: k.keyword, company: k.company })),
    allResults,
    `pages_sheet_${timestamp}.csv`
  );

  // 5. 전체 내보내기 (안전장치)
  logger.divider('전체 내보내기');
  for (const sheetType of activeSheetTypes) {
    await exportSheetAPI(sheetType);
  }

  // 종합 탭 내보내기
  try {
    const res = await axios.post(`${PAGE_CHECK_API}/api/page-check/export-all`);
    const totalRows = res.data.totalRows ?? res.data.count ?? 0;
    const updatedCells = res.data.updatedCells ?? '';
    logger.success(
      `  종합: ${totalRows}개 내보내기${updatedCells ? ` (${updatedCells}셀)` : ''}`
    );
  } catch (error) {
    logger.error(`  종합 내보내기 실패: ${(error as Error).message}`);
  }
  logger.blank();

  // 6. 결과 요약
  const elapsedMs = Date.now() - startTime;
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
  const elapsedTimeStr =
    hours > 0
      ? `${hours}시간 ${minutes}분 ${seconds}초`
      : minutes > 0
        ? `${minutes}분 ${seconds}초`
        : `${seconds}초`;

  const popularCount = allResults.filter(
    (r) => r.exposureType === '인기글'
  ).length;
  const sblCount = allResults.filter((r) => r.exposureType === '스블').length;
  const newLogicCount = allResults.filter((r) => r.isNewLogic === true).length;
  const oldLogicCount = allResults.filter((r) => r.isNewLogic === false).length;

  logger.summary.complete(`📄 멀티페이지 크론 [${sheetLabel}] 완료 요약`, [
    { label: '총 검색어', value: `${totalKeywords}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '신규로직', value: `${newLogicCount}개` },
    { label: '구로직', value: `${oldLogicCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
  ]);

  // 7. Dooray 메시지 전송
  const sheetStats = activeSheetTypes
    .map((st) => ({
      name: SHEET_TYPE_NAMES[st],
      count: keywordsBySheet[st].filter((k) =>
        allResults.some((r) => r.query === k.keyword)
      ).length,
    }))
    .filter((s) => s.count > 0);

  // 미노출 키워드 (변경=false인 것만)
  const exposedKeywords = new Set(allResults.map((r) => r.query));
  const allKeywords = activeSheetTypes.flatMap((st) => keywordsBySheet[st]);
  const missingKeywords = allKeywords
    .filter((k) => !exposedKeywords.has(k.keyword) && !k.isUpdateRequired)
    .map((k) => k.keyword);

  await sendDoorayExposureResult({
    cronType: `멀티페이지 크론 [${sheetLabel}]`,
    totalKeywords,
    exposureCount: allResults.length,
    popularCount,
    sblCount,
    elapsedTime: elapsedTimeStr,
    sheetStats,
    missingKeywords,
    newLogicCount,
    oldLogicCount,
  });

  const logBuilder = createDetailedLogBuilder();
  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, `pages_${timestamp}`, elapsedTimeStr);

  await closeBrowser();
  await disconnectDB();
}

if (require.main === module) {
  const args = process.argv.slice(2);

  let targetSheetTypes: PageCheckSheetType[] | undefined;

  // --exclude 옵션 처리
  const excludeIndex = args.indexOf('--exclude');
  if (excludeIndex !== -1 && args[excludeIndex + 1]) {
    const excludeType = args[excludeIndex + 1] as PageCheckSheetType;
    if (SHEET_TYPES.includes(excludeType)) {
      targetSheetTypes = SHEET_TYPES.filter((st) => st !== excludeType);
      logger.info(`🚫 제외 모드: ${SHEET_TYPE_NAMES[excludeType]} 제외`);
    } else {
      logger.error(`❌ 유효하지 않은 sheetType: ${excludeType}`);
      logger.info(`사용 가능: ${SHEET_TYPES.join(', ')}`);
      process.exit(1);
    }
  } else {
    const sheetTypeArg = args[0] as PageCheckSheetType | undefined;

    if (sheetTypeArg && SHEET_TYPES.includes(sheetTypeArg)) {
      targetSheetTypes = [sheetTypeArg];
      logger.info(`🎯 단일 시트 모드: ${SHEET_TYPE_NAMES[sheetTypeArg]}`);
    } else if (sheetTypeArg) {
      logger.error(`❌ 유효하지 않은 sheetType: ${sheetTypeArg}`);
      logger.info(`사용 가능: ${SHEET_TYPES.join(', ')}`);
      process.exit(1);
    }
  }

  main(targetSheetTypes).catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
