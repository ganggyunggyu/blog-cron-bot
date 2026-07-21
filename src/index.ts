import * as dotenv from 'dotenv';
import { connectDB, disconnectDB, getAllKeywords } from './database';
import { saveToCSV, saveToSheetCSV } from './csv-writer';
import { getSheetOptions } from './sheet-config';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import { closeBrowser, launchBrowser } from './lib/playwright-crawler';
import {
  getExposureConcurrency,
  getExposureMaxPages,
} from './lib/exposure-run-config';
import { getKSTTimestamp } from './utils';
import { sendDoorayExposureResult } from './lib/dooray';
import { ExposureResult } from './matcher';
import { DOGMARU_PAGE_CHECK_BLOG_IDS } from './constants/blog-ids';
import {
  OrderedResultTarget,
  rewriteOrderedResultSheet,
} from './lib/google-sheets/ordered-result-sheet';

dotenv.config();

const runExposureWorkflow = async (): Promise<void> => {
  const startTime = Date.now();

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

  const allKeywords = await getAllKeywords();

  const onlySheetType = (process.env.ONLY_SHEET_TYPE || '').trim();
  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();
  const concurrency = getExposureConcurrency();
  const maxPages = getExposureMaxPages(1);

  let filtered = allKeywords;
  const normalize = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');

  if (onlySheetType)
    filtered = filtered.filter(
      (k: any) => normalize(k.sheetType) === normalize(onlySheetType)
    );
  if (onlyCompany)
    filtered = filtered.filter(
      (k: any) => normalize(k.company) === normalize(onlyCompany)
    );
  if (onlyKeywordRegex) {
    try {
      const re = new RegExp(onlyKeywordRegex);
      filtered = filtered.filter((k: any) => re.test(k.keyword));
    } catch {}
  }
  if (onlyId) {
    filtered = filtered.filter((k: any) => String(k._id) === onlyId);
  }

  const startIndexRaw = Number(process.env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexRaw)
    ? Math.max(0, Math.min(startIndexRaw, filtered.length))
    : 0;

  const keywords = filtered.slice(startIndex);
  logger.info(
    `📋 검색어 ${keywords.length}개 처리 예정 (필터 applied, start=${startIndex})`
  );
  if (maxPages > 1) {
    logger.info(`📄 멀티페이지 검색 활성화: 최대 ${maxPages}페이지`);
  }
  logger.info(`⚡ 키워드 동시 처리: 최대 ${concurrency}개`);
  logger.blank();

  if (concurrency > 1 && maxPages > 1 && keywords.length > 0) {
    await launchBrowser();
  }

  const logBuilder = createDetailedLogBuilder();
  const keywordLogicMap = new Map<string, boolean>();

  const dogmaruKeywords = keywords.filter((k: any) => k.sheetType === 'dogmaru');
  const otherKeywords = keywords.filter((k: any) => k.sheetType !== 'dogmaru');

  const allResults: ExposureResult[] = [];

  if (otherKeywords.length > 0) {
    logger.info(`📦 패키지/일반건 ${otherKeywords.length}개 처리`);
    const results = await processKeywords(otherKeywords, logBuilder, {
      isLoggedIn: loginStatus.isLoggedIn,
      maxPages,
      concurrency,
      keywordLogicMap,
    });
    allResults.push(...results);
  }

  if (dogmaruKeywords.length > 0) {
    logger.info(`🐕 도그마루 ${dogmaruKeywords.length}개 처리 (전체 블로그 기준)`);
    const results = await processKeywords(dogmaruKeywords, logBuilder, {
      isLoggedIn: loginStatus.isLoggedIn,
      maxPages,
      concurrency,
      blogIds: DOGMARU_PAGE_CHECK_BLOG_IDS,
      keywordLogicMap,
    });
    allResults.push(...results);
  }

  const timestamp = getKSTTimestamp();
  const filterSheet = (process.env.ONLY_SHEET_TYPE || '').trim();
  const csvPrefix = filterSheet
    ? getSheetOptions(filterSheet).csvFilePrefix
    : 'results';
  const filename = `${csvPrefix}_${timestamp}.csv`;

  saveToCSV(allResults, filename);
  saveToSheetCSV(
    keywords.map((k: any) => ({ keyword: k.keyword, company: k.company })),
    allResults,
    `${csvPrefix}_sheet_${timestamp}.csv`,
    keywordLogicMap
  );

  const orderedTargetBySheetType: Record<string, OrderedResultTarget> = {
    package: 'package',
    'dogmaru-exclude': 'general',
    dogmaru: 'dogmaru',
  };
  const orderedTarget = orderedTargetBySheetType[onlySheetType];
  if (orderedTarget) {
    await rewriteOrderedResultSheet(
      orderedTarget,
      allResults,
      keywordLogicMap,
      keywords.map((keyword) => ({
        keyword: keyword.keyword,
        company: keyword.company,
      }))
    );
  }

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

  logger.summary.complete('크롤링 완료 요약', [
    { label: '총 검색어', value: `${keywords.length}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '신규로직', value: `${newLogicCount}개` },
    { label: '구로직', value: `${oldLogicCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
  ]);

  // 미노출 키워드 (변경=false인 것만)
  const exposedKeywords = new Set(allResults.map((r) => r.query));
  const missingKeywords = keywords
    .filter((k: any) => !exposedKeywords.has(k.keyword) && !k.isUpdateRequired)
    .map((k: any) => k.keyword);

  // Dooray 메시지 전송
  const SHEET_TYPE_LABELS: Record<string, string> = {
    package: '패키지 노출체크',
    'dogmaru-exclude': '일반건 노출체크',
    dogmaru: '도그마루 노출체크',
  };
  const cronTypeLabel = SHEET_TYPE_LABELS[onlySheetType] ?? '패키지 일반건 노출체크';

  await sendDoorayExposureResult({
    cronType: cronTypeLabel,
    totalKeywords: keywords.length,
    exposureCount: allResults.length,
    popularCount,
    sblCount,
    elapsedTime: elapsedTimeStr,
    missingKeywords,
    newLogicCount,
    oldLogicCount,
  });

  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, timestamp, elapsedTimeStr);

  const stats = logBuilder.getStats();
  logger.summary.complete('상세 로그 저장 완료', [
    { label: '총 로그 엔트리', value: `${stats.total}개` },
    { label: '성공', value: `${stats.success}개` },
    { label: '실패', value: `${stats.failed}개` },
  ]);
};

export async function main(): Promise<void> {
  try {
    await runExposureWorkflow();
  } finally {
    try {
      await closeBrowser();
    } finally {
      await disconnectDB();
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
