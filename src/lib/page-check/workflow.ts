import { connectDB } from '../../database';
import { checkNaverLogin } from '../check-naver-login';
import { logger } from '../logger';
import {
  isPageCheckSheetType,
  PAGE_CHECK_SHEET_TYPES,
  PAGE_CHECK_SHEET_TYPE_NAMES,
  PAGE_CHECK_TARGET_NAMES,
  type PageCheckRunTarget,
} from './config';
import { executePageCheckCrawl } from './crawl-executor';
import { saveAndExportPageCheckResults } from './result-output';
import { reportPageCheckRun } from './run-reporter';
import { syncAndLoadPageCheckTargets } from './target-loader';

const logLoginStatus = async (): Promise<boolean> => {
  const loginStatus = await checkNaverLogin();
  logger.divider('로그인 상태');
  if (loginStatus.isLoggedIn) {
    logger.success(`🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`);
  } else {
    logger.info('🌐 비로그인 모드');
  }
  logger.blank();
  return loginStatus.isLoggedIn;
};

const getMongoUri = (): string => {
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) return mongoUri;

  logger.error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
};

export const runPageCheckWorkflow = async (
  targetSheetTypes?: PageCheckRunTarget[]
): Promise<void> => {
  const startedAt = Date.now();
  const activeTargets = targetSheetTypes ?? PAGE_CHECK_SHEET_TYPES;
  const activeSheetTypes = activeTargets.filter(isPageCheckSheetType);
  const includesDogmaru = activeTargets.includes('dogmaru');
  const sheetLabel = targetSheetTypes
    ? activeTargets.map((target) => PAGE_CHECK_TARGET_NAMES[target]).join(' + ')
    : '전체';
  const pageSheetLabel = activeSheetTypes
    .map((sheetType) => PAGE_CHECK_SHEET_TYPE_NAMES[sheetType])
    .join(' + ');

  logger.divider(`📄 멀티페이지 크론 [${sheetLabel}]`);
  const isLoggedIn = await logLoginStatus();
  await connectDB(getMongoUri());

  const loadedTargets = await syncAndLoadPageCheckTargets(
    activeSheetTypes,
    includesDogmaru
  );
  if (loadedTargets.totalKeywords === 0) {
    logger.warn('처리할 키워드가 없습니다.');
    return;
  }

  logger.divider(`노출체크 시작 (${activeTargets.length}개 대상 병렬)`);
  const crawlResult = await executePageCheckCrawl({
    activeTargets,
    activeSheetTypes,
    keywordsBySheet: loadedTargets.keywordsBySheet,
    dogmaruKeywords: loadedTargets.dogmaruKeywords,
    isLoggedIn,
  });
  logger.blank();

  const savedResults = await saveAndExportPageCheckResults({
    activeSheetTypes,
    keywordsBySheet: loadedTargets.keywordsBySheet,
    sheetResults: crawlResult.sheetResults,
    dogmaruResult: crawlResult.dogmaruResult,
    keywordLogicMap: crawlResult.keywordLogicMap,
    startedAt,
  });

  await reportPageCheckRun({
    activeSheetTypes,
    sheetLabel,
    pageSheetLabel,
    keywordsBySheet: loadedTargets.keywordsBySheet,
    totalPageKeywords: loadedTargets.totalPageKeywords,
    totalKeywords: loadedTargets.totalKeywords,
    sheetResults: crawlResult.sheetResults,
    dogmaruResult: crawlResult.dogmaruResult,
    allResults: savedResults.allResults,
    timestamp: savedResults.timestamp,
    startedAt,
  });
};
