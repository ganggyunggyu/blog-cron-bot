import * as dotenv from 'dotenv';
import axios from 'axios';
import {
  connectDB,
  disconnectDB,
  getPageCheckKeywords,
  replacePageCheckKeywords,
  updatePageCheckKeywordResult,
  IPageCheckKeyword,
  PageCheckSheetType,
} from './database';
import { saveToCSV, saveToSheetCSV } from './csv-writer';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import { closeBrowser, launchBrowser } from './lib/playwright-crawler';
import { getKSTTimestamp, getSearchQuery } from './utils';
import { ExposureResult } from './matcher';
import type { DetailedLog } from './types';
import { sendDoorayExposureResult } from './lib/dooray';
import { PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE } from './constants/blog-ids';
import {
  loadSuripetKeywordsFromSheet,
  writeSuripetResultsToSheet,
} from './lib/google-sheets/suripet-page-check';
import {
  getExposureConcurrency,
  getExposureMaxPages,
  splitConcurrencyBudget,
} from './lib/exposure-run-config';
import {
  SharedCrawlCoordinator,
  buildSharedCrawlPlans,
} from './lib/keyword-processor/shared-crawl-coordinator';
import type { SharedCrawlContext } from './lib/keyword-processor/types';
import { buildDogPetCompositeCrawlInputs } from './lib/exposure-suite/dog-pet-composite';
import {
  finalizeDogmaruCompositeTarget,
  processDogmaruCompositeTarget,
  syncAndLoadDogmaruKeywords,
  type DogmaruCompositeResult,
} from './lib/exposure-suite/dogmaru-composite-target';
import { waitForAllOrThrow } from './lib/exposure-suite/settle';
import { summarizeExposureRows } from './lib/exposure-summary';

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

type PageCheckRunTarget = PageCheckSheetType | 'dogmaru';

const DOG_PET_COMPOSITE_TARGETS: readonly PageCheckRunTarget[] = [
  'dogmaru',
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

const RUN_TARGET_NAMES: Record<PageCheckRunTarget, string> = {
  ...SHEET_TYPE_NAMES,
  dogmaru: '도그마루',
};

// 시트별 최대 페이지 수 설정 (기본값: 4)
const MAX_PAGES_BY_SHEET: Partial<Record<PageCheckSheetType, number>> = {
  'black-goat-old': 1,
  suripet: 9,
  pet: 9,
};

const DEFAULT_MAX_PAGES = 4;

interface SheetProcessResult {
  sheetType: PageCheckSheetType;
  results: ExposureResult[];
  logs: DetailedLog[];
}

interface ImportAllResponse {
  data: {
    stats: Array<{ label: string; inserted: number }>;
    totalInserted: number;
  };
}

interface SheetCountResponse {
  data: {
    inserted?: number;
    count?: number;
  };
}

interface SheetExportResponse {
  data: {
    totalRows?: number;
    count?: number;
    updatedCells?: string | number;
  };
}

type ImportAllRequest = () => Promise<ImportAllResponse>;
type ImportSheetRequest = (
  sheetType: PageCheckSheetType
) => Promise<SheetCountResponse>;
type ExportSheetRequest = (
  sheetType: PageCheckSheetType
) => Promise<SheetExportResponse>;
type ExportAllRequest = () => Promise<SheetExportResponse>;

interface ImportSheetDependencies {
  importPageSheet: ImportSheetRequest;
  importSuripet: () => Promise<number>;
}

interface ExportSheetDependencies {
  exportPageSheet: ExportSheetRequest;
  exportSuripet: () => Promise<void>;
}

const getMaxPagesForSheet = (sheetType: PageCheckSheetType): number =>
  getExposureMaxPages(
    MAX_PAGES_BY_SHEET[sheetType] ?? DEFAULT_MAX_PAGES
  );

const isPageCheckSheetType = (
  target: PageCheckRunTarget
): target is PageCheckSheetType => target !== 'dogmaru';

export async function syncAllSheetsAPI(
  request: ImportAllRequest = () =>
    axios.post(`${PAGE_CHECK_API}/api/page-check/import-all`)
): Promise<number> {
  try {
    const res = await request();
    const { stats, totalInserted } = res.data;

    for (const r of stats) {
      logger.success(`  ${r.label}: ${r.inserted}개 동기화`);
    }

    return totalInserted;
  } catch (error) {
    logger.error(`시트 동기화 실패: ${(error as Error).message}`);
    throw error;
  }
}

// 서리펫은 PAGE_CHECK_API(외부 서버)에 의존하지 않고 direct-write로 시트에 바로 반영함
async function exportSuripetSheetDirect(): Promise<void> {
  const keywords = await getPageCheckKeywords('suripet');
  await writeSuripetResultsToSheet(
    keywords.map((keyword) => ({
      keyword: keyword.keyword,
      visibility: keyword.visibility,
      popularTopic: keyword.popularTopic,
      url: keyword.url,
      postPublishedAt: keyword.postPublishedAt,
      keywordType: keyword.keywordType,
      matchedTitle: keyword.matchedTitle,
      rank: keyword.rank,
      rankWithCafe: keyword.rankWithCafe,
      isUpdateRequired: keyword.isUpdateRequired,
      isNewLogic: keyword.isNewLogic,
      foundPage: keyword.foundPage,
    }))
  );
}

export async function exportSheetAPI(
  sheetType: PageCheckSheetType,
  dependencies: Partial<ExportSheetDependencies> = {}
): Promise<void> {
  const exportPageSheet =
    dependencies.exportPageSheet ??
    ((targetSheetType: PageCheckSheetType) =>
      axios.post(`${PAGE_CHECK_API}/api/page-check/export`, {
        sheetType: targetSheetType,
      }));
  const exportSuripet =
    dependencies.exportSuripet ?? exportSuripetSheetDirect;

  try {
    if (sheetType === 'suripet') {
      await exportSuripet();
      return;
    }

    const res = await exportPageSheet(sheetType);
    const totalRows = res.data.totalRows ?? res.data.count ?? 0;
    const updatedCells = res.data.updatedCells ?? '';
    logger.success(
      `  ${SHEET_TYPE_NAMES[sheetType]}: ${totalRows}개 내보내기${updatedCells ? ` (${updatedCells}셀)` : ''}`
    );
  } catch (error) {
    logger.error(
      `  ${SHEET_TYPE_NAMES[sheetType]} 내보내기 실패: ${(error as Error).message}`
    );
    throw error;
  }
}

export const syncSuripetKeywordsFromSheetToDB = async (): Promise<number> => {
  const keywords = await loadSuripetKeywordsFromSheet();
  const synced = await replacePageCheckKeywords('suripet', keywords);

  logger.success(`  ${SHEET_TYPE_NAMES.suripet}: ${synced}개 직접 동기화`);

  return synced;
};

export async function importSheetAPI(
  sheetType: PageCheckSheetType,
  dependencies: Partial<ImportSheetDependencies> = {}
): Promise<number> {
  const importPageSheet =
    dependencies.importPageSheet ??
    ((targetSheetType: PageCheckSheetType) =>
      axios.post(`${PAGE_CHECK_API}/api/page-check/import`, {
        sheetType: targetSheetType,
      }));
  const importSuripet =
    dependencies.importSuripet ?? syncSuripetKeywordsFromSheetToDB;

  try {
    if (sheetType === 'suripet') {
      return await importSuripet();
    }

    const res = await importPageSheet(sheetType);
    const inserted = res.data.inserted ?? res.data.count ?? 0;
    logger.success(`  ${SHEET_TYPE_NAMES[sheetType]}: ${inserted}개 동기화`);
    return inserted;
  } catch (error) {
    logger.error(
      `  ${SHEET_TYPE_NAMES[sheetType]} 불러오기 실패: ${(error as Error).message}`
    );
    throw error;
  }
}

export async function exportAllSheetsAPI(
  request: ExportAllRequest = () =>
    axios.post(`${PAGE_CHECK_API}/api/page-check/export-all`)
): Promise<void> {
  try {
    const res = await request();
    const totalRows = res.data.totalRows ?? res.data.count ?? 0;
    const updatedCells = res.data.updatedCells ?? '';
    logger.success(
      `  종합: ${totalRows}개 내보내기${updatedCells ? ` (${updatedCells}셀)` : ''}`
    );
  } catch (error) {
    logger.error(`  종합 내보내기 실패: ${(error as Error).message}`);
    throw error;
  }
}

const syncPageSheetTypes = async (
  activeSheetTypes: PageCheckSheetType[]
): Promise<void> => {
  if (activeSheetTypes.length === 0) return;

  if (activeSheetTypes.length === SHEET_TYPES.length) {
    const totalSynced = await syncAllSheetsAPI();
    if (activeSheetTypes.includes('suripet')) {
      const suripetSynced = await syncSuripetKeywordsFromSheetToDB();
      logger.info(
        `📥 총 ${totalSynced}개 키워드 동기화 완료 + 서리펫 ${suripetSynced}개 직접 동기화`
      );
    } else {
      logger.info(`📥 총 ${totalSynced}개 키워드 동기화 완료`);
    }
    return;
  }

  const syncedCounts = await Promise.all(
    activeSheetTypes.map((sheetType) => importSheetAPI(sheetType))
  );
  const totalSynced = syncedCounts.reduce((sum, count) => sum + count, 0);
  logger.info(`📥 ${totalSynced}개 키워드 동기화 완료`);
};

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
    foundPage?: number,
    postPublishedAt?: string
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
      foundPage,
      postPublishedAt
    );
  };
}

async function processSheetKeywords(
  sheetType: PageCheckSheetType,
  keywords: IPageCheckKeyword[],
  isLoggedIn: boolean,
  concurrency: number,
  keywordLogicMap?: Map<string, boolean>,
  sharedCrawlContext?: SharedCrawlContext
): Promise<SheetProcessResult> {
  const typeName = SHEET_TYPE_NAMES[sheetType];
  const maxPages = getMaxPagesForSheet(sheetType);
  const logBuilder = createDetailedLogBuilder();

  const blogIds = PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE[sheetType];

  logger.info(
    `[${typeName}] 🚀 ${keywords.length}개 키워드 처리 시작 (${maxPages}페이지)`
  );

  const results = await processKeywords(keywords as any, logBuilder, {
    updateFunction: createUpdateFunction(sheetType),
    isLoggedIn,
    maxPages,
    concurrency,
    blogIds,
    keywordLogicMap,
    // 애견/서리펫의 같은 키워드 행은 같은 계정 범위를 확인하므로 첫 매칭을 재사용한다.
    consumeMatches: sheetType !== 'pet' && sheetType !== 'suripet',
    sharedCrawlContext,
    progressTarget: sheetType,
  });

  logger.success(`[${typeName}] ✅ 완료: ${results.length}개 노출 발견`);

  return { sheetType, results, logs: logBuilder.getLogs() };
}

const runPageCheckWorkflow = async (
  targetSheetTypes?: PageCheckRunTarget[]
): Promise<void> => {
  const startTime = Date.now();
  const activeTargets: PageCheckRunTarget[] = targetSheetTypes ?? SHEET_TYPES;
  const activeSheetTypes = activeTargets.filter(isPageCheckSheetType);
  const includesDogmaru = activeTargets.includes('dogmaru');
  const sheetLabel = targetSheetTypes
    ? activeTargets
        .map((target) => RUN_TARGET_NAMES[target])
        .join(' + ')
    : '전체';
  const pageSheetLabel = activeSheetTypes
    .map((sheetType) => SHEET_TYPE_NAMES[sheetType])
    .join(' + ');

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
    throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  }

  await connectDB(mongoUri);

  // 1. 시트 → DB 동기화 (외부 API)
  logger.divider('시트 동기화');
  const [dogmaruKeywords = []] = await waitForAllOrThrow([
    includesDogmaru
      ? syncAndLoadDogmaruKeywords()
      : Promise.resolve([]),
    syncPageSheetTypes(activeSheetTypes).then(() => []),
  ]);
  logger.blank();

  // 2. DB 연결 및 키워드 조회
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
    const keywords = await getPageCheckKeywords(sheetType);
    keywordsBySheet[sheetType] = keywords;
    logger.info(`  ${SHEET_TYPE_NAMES[sheetType]}: ${keywords.length}개`);
  }

  const totalPageKeywords = Object.values(keywordsBySheet).reduce(
    (sum, keywords) => sum + keywords.length,
    0
  );
  const totalKeywords = totalPageKeywords + dogmaruKeywords.length;
  if (includesDogmaru) {
    logger.info(`  도그마루: ${dogmaruKeywords.length}개`);
  }
  logger.info(`📋 총 ${totalKeywords}개 키워드 로드 완료`);
  logger.blank();

  if (totalKeywords === 0) {
    logger.warn('처리할 키워드가 없습니다.');
    return;
  }

  // 3. 시트 병렬 노출체크
  logger.divider(`노출체크 시작 (${activeTargets.length}개 대상 병렬)`);

  const keywordLogicMap = new Map<string, boolean>();

  const nonEmptySheetTypes = activeSheetTypes.filter(
    (sheetType) => keywordsBySheet[sheetType].length > 0
  );
  const totalConcurrency = getExposureConcurrency();
  const { taskConcurrency, perTaskConcurrency } = splitConcurrencyBudget(
    totalConcurrency,
    nonEmptySheetTypes.length + (dogmaruKeywords.length > 0 ? 1 : 0)
  );

  const isDogPetComposite =
    includesDogmaru &&
    activeSheetTypes.length === 2 &&
    activeSheetTypes.includes('pet') &&
    activeSheetTypes.includes('suripet');
  const isPetComposite =
    !includesDogmaru &&
    nonEmptySheetTypes.length === 2 &&
    nonEmptySheetTypes.includes('pet') &&
    nonEmptySheetTypes.includes('suripet');
  const sharedPlanInputs = isDogPetComposite
    ? buildDogPetCompositeCrawlInputs(
        {
          dogmaru: dogmaruKeywords.map((keyword) =>
            getSearchQuery(keyword.keyword)
          ),
          pet: keywordsBySheet.pet.map((keyword) =>
            getSearchQuery(keyword.keyword)
          ),
          suripet: keywordsBySheet.suripet.map((keyword) =>
            getSearchQuery(keyword.keyword)
          ),
        },
        getMaxPagesForSheet('pet'),
        getMaxPagesForSheet('suripet')
      )
    : isPetComposite
      ? (['pet', 'suripet'] as const).map((sheetType) => ({
          searchQueries: keywordsBySheet[sheetType].map((keyword) =>
            getSearchQuery(keyword.keyword)
          ),
          maxPages: getMaxPagesForSheet(sheetType),
          blogIds: PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE[sheetType],
        }))
      : undefined;
  const sharedCrawlContext: SharedCrawlContext | undefined = sharedPlanInputs
    ? {
        coordinator: new SharedCrawlCoordinator(totalConcurrency),
        plans: buildSharedCrawlPlans(sharedPlanInputs),
      }
    : undefined;

  if (sharedCrawlContext) {
    logger.info(
      `⚡ ${isDogPetComposite ? '도그마루·애견·서리펫' : '애견·서리펫'} 처리 워커 각 ${totalConcurrency}, 외부 요청 합계 최대 ${totalConcurrency}`
    );
    logger.info(
      `♻️ ${sharedCrawlContext.plans.size}개 고유 검색어 크롤 결과 공유`
    );
  } else {
    logger.info(
      `⚡ 총 동시성 ${totalConcurrency}: 시트 ${taskConcurrency}개 × 시트당 키워드 ${perTaskConcurrency}개`
    );
  }

  const shouldPrewarmBrowser = nonEmptySheetTypes.some(
    (sheetType) => getMaxPagesForSheet(sheetType) > 1
  );
  if (totalConcurrency > 1 && shouldPrewarmBrowser) {
    await launchBrowser();
  }

  const sheetResults: SheetProcessResult[] = [];
  let dogmaruResult: DogmaruCompositeResult | undefined;

  if (sharedCrawlContext) {
    type SharedTargetResult =
      | { target: 'page'; result: SheetProcessResult }
      | { target: 'dogmaru'; result: DogmaruCompositeResult };
    const sharedTargetPromises: Promise<SharedTargetResult>[] =
      nonEmptySheetTypes.map(async (sheetType) => ({
        target: 'page' as const,
        result: await processSheetKeywords(
          sheetType,
          keywordsBySheet[sheetType],
          loginStatus.isLoggedIn,
          totalConcurrency,
          keywordLogicMap,
          sharedCrawlContext
        ),
      }));

    if (dogmaruKeywords.length > 0) {
      sharedTargetPromises.push(
        processDogmaruCompositeTarget(
          dogmaruKeywords,
          loginStatus.isLoggedIn,
          totalConcurrency,
          sharedCrawlContext
        ).then((result) => ({ target: 'dogmaru' as const, result }))
      );
    }

    const targetResults = await waitForAllOrThrow(sharedTargetPromises);
    targetResults.forEach((targetResult) => {
      if (targetResult.target === 'dogmaru') {
        dogmaruResult = targetResult.result;
      } else {
        sheetResults.push(targetResult.result);
      }
    });
  } else {
    for (
      let startIndex = 0;
      startIndex < nonEmptySheetTypes.length;
      startIndex += taskConcurrency
    ) {
      const sheetBatch = nonEmptySheetTypes.slice(
        startIndex,
        startIndex + taskConcurrency
      );
      const batchResults = await waitForAllOrThrow(
        sheetBatch.map((sheetType) =>
          processSheetKeywords(
            sheetType,
            keywordsBySheet[sheetType],
            loginStatus.isLoggedIn,
            perTaskConcurrency,
            keywordLogicMap
          )
        )
      );
      sheetResults.push(...batchResults);
    }
  }

  const allResults = sheetResults.flatMap(({ results }) => results);

  logger.blank();

  // 4. CSV 저장
  const timestamp = getKSTTimestamp();
  const filename = `pages_${timestamp}.csv`;
  saveToCSV(allResults, filename);

  const flatKeywords = Object.values(keywordsBySheet).flat();
  saveToSheetCSV(
    flatKeywords.map((k) => ({ keyword: k.keyword, company: k.company })),
    allResults,
    `pages_sheet_${timestamp}.csv`,
    keywordLogicMap
  );

  // 5. 전체 내보내기 (안전장치)
  logger.divider('전체 내보내기');
  for (const sheetType of activeSheetTypes) {
    await exportSheetAPI(sheetType);
  }

  // 종합 탭 내보내기
  await exportAllSheetsAPI();

  // 모든 페이지 결과 반영이 성공한 뒤 도그마루 결과를 반영한다. 알림은
  // 아래에서 한 번만 보내 재시도 시 중복 알림을 만들지 않는다.
  if (dogmaruResult) {
    await finalizeDogmaruCompositeTarget(dogmaruResult, startTime);
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

  logger.summary.complete(`📄 멀티페이지 크론 [${pageSheetLabel}] 완료 요약`, [
    { label: '총 검색어', value: `${totalPageKeywords}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '신규로직', value: `${newLogicCount}개` },
    { label: '구로직', value: `${oldLogicCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
  ]);

  // 7. Dooray 메시지 전송
  const resultsBySheetType = new Map(
    sheetResults.map(({ sheetType, results }) => [sheetType, results])
  );
  const pageSummaries = new Map(
    activeSheetTypes.map((sheetType) => [
      sheetType,
      summarizeExposureRows(
        keywordsBySheet[sheetType],
        resultsBySheetType.get(sheetType) ?? []
      ),
    ])
  );
  const dogmaruSummary = dogmaruResult
    ? summarizeExposureRows(dogmaruResult.keywords, dogmaruResult.results)
    : undefined;
  const sheetStats = [
    ...activeSheetTypes.map((sheetType) => ({
      name: SHEET_TYPE_NAMES[sheetType],
      count: pageSummaries.get(sheetType)?.exposedCount ?? 0,
    })),
    ...(dogmaruSummary
      ? [{ name: RUN_TARGET_NAMES.dogmaru, count: dogmaruSummary.exposedCount }]
      : []),
  ].filter((summary) => summary.count > 0);
  const missingKeywords = [
    ...activeSheetTypes.flatMap(
      (sheetType) => pageSummaries.get(sheetType)?.missingKeywords ?? []
    ),
    ...(dogmaruSummary?.missingKeywords ?? []),
  ];
  const notificationResults = [
    ...allResults,
    ...(dogmaruResult?.results ?? []),
  ];
  const notificationPopularCount = notificationResults.filter(
    (result) => result.exposureType === '인기글'
  ).length;
  const notificationSblCount = notificationResults.filter(
    (result) => result.exposureType === '스블'
  ).length;
  const notificationNewLogicCount = notificationResults.filter(
    (result) => result.isNewLogic === true
  ).length;
  const notificationOldLogicCount = notificationResults.filter(
    (result) => result.isNewLogic === false
  ).length;

  await sendDoorayExposureResult({
    cronType: `멀티페이지 크론 [${sheetLabel}]`,
    totalKeywords,
    exposureCount: notificationResults.length,
    popularCount: notificationPopularCount,
    sblCount: notificationSblCount,
    elapsedTime: elapsedTimeStr,
    sheetStats,
    missingKeywords,
    newLogicCount: notificationNewLogicCount,
    oldLogicCount: notificationOldLogicCount,
  });

  const logs = sheetResults.flatMap((result) => result.logs);
  saveDetailedLogs(logs, `pages_${timestamp}`, elapsedTimeStr);
};

export async function main(
  targetSheetTypes?: PageCheckRunTarget[]
): Promise<void> {
  try {
    await runPageCheckWorkflow(targetSheetTypes);
  } finally {
    try {
      await closeBrowser();
    } finally {
      await disconnectDB();
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);

  let targetSheetTypes: PageCheckRunTarget[] | undefined;

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
    const sheetTypeArg = args[0];
    const requestedSheetTypes = Array.from(
      new Set(
        (sheetTypeArg ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    const availableTargets: PageCheckRunTarget[] = [
      ...SHEET_TYPES,
      'dogmaru',
    ];
    const invalidSheetTypes = requestedSheetTypes.filter(
      (sheetType) => !availableTargets.includes(sheetType as PageCheckRunTarget)
    );
    const requestsDogmaru = requestedSheetTypes.includes('dogmaru');
    const isExactDogPetComposite =
      requestedSheetTypes.length === DOG_PET_COMPOSITE_TARGETS.length &&
      DOG_PET_COMPOSITE_TARGETS.every((target) =>
        requestedSheetTypes.includes(target)
      );
    const hasValidDogmaruScope =
      !requestsDogmaru || isExactDogPetComposite;

    if (
      requestedSheetTypes.length > 0 &&
      invalidSheetTypes.length === 0 &&
      hasValidDogmaruScope
    ) {
      targetSheetTypes = requestedSheetTypes as PageCheckRunTarget[];
      logger.info(
        `🎯 대상 시트: ${targetSheetTypes
          .map((target) => RUN_TARGET_NAMES[target])
          .join(', ')}`
      );
    } else if (sheetTypeArg) {
      const invalidScope = invalidSheetTypes.join(', ') || sheetTypeArg;
      logger.error(`❌ 유효하지 않은 sheetType 조합: ${invalidScope}`);
      logger.info(
        `사용 가능: ${SHEET_TYPES.join(', ')} 또는 dogmaru,pet,suripet`
      );
      process.exit(1);
    }
  }

  main(targetSheetTypes).catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
