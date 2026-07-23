import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllRootKeywords,
  updateRootKeywordResult,
  IRootKeyword,
} from './database';
import { saveToCSV, saveToSheetCSV } from './csv-writer';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import { getKSTTimestamp } from './utils';
import { sendDoorayExposureResult } from './lib/dooray';
import { autoLogin } from './tools/auto-login';
import { closeBrowser, launchBrowser } from './lib/playwright-crawler';
import {
  getExposureConcurrency,
  getExposureMaxPages,
} from './lib/exposure-run-config';
import { rewriteOrderedResultSheet } from './lib/google-sheets/ordered-result-sheet';
import { syncRootKeywordsFromSheet } from './lib/root-keyword-sync';
import { BLOG_IDS } from './constants/blog-ids';

dotenv.config();

const runRootWorkflow = async (): Promise<void> => {
  const startTime = Date.now();
  const isDistributedShard =
    process.env.DISTRIBUTED_EXPOSURE_SHARD === 'true';

  let loginStatus = await checkNaverLogin();
  logger.divider('로그인 상태');
  if (!loginStatus.isLoggedIn) {
    logger.warn('🔑 로그인 필요, 자동 로그인 시도...');
    const loginSuccess = await autoLogin();
    if (!loginSuccess) {
      logger.error('❌ 자동 로그인 실패');
      throw new Error('자동 로그인 실패');
    }
    loginStatus = await checkNaverLogin();
  }

  if (loginStatus.isLoggedIn) {
    logger.success(
      `🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`
    );
  } else {
    logger.error('❌ 로그인 확인 실패');
    throw new Error('로그인 확인 실패');
  }
  logger.blank();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  }

  await connectDB(mongoUri);

  if (!isDistributedShard) {
    const syncResult = await syncRootKeywordsFromSheet();
    logger.success(
      `DB 동기화 완료! (삭제: ${syncResult.deleted}, 삽입: ${syncResult.inserted}, 경로: ${syncResult.source})`
    );
  }

  const allKeywords = await getAllRootKeywords();

  const distributedKeywordIds = new Set(
    String(process.env.DISTRIBUTED_EXPOSURE_KEYWORD_IDS ?? '')
      .split(',')
      .filter(Boolean)
  );
  if (isDistributedShard && distributedKeywordIds.size === 0) {
    throw new Error('분산 루트 keyword ids 누락');
  }

  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

  let filtered = allKeywords as IRootKeyword[];
  if (isDistributedShard) {
    filtered = filtered.filter((keyword) =>
      distributedKeywordIds.has(String(keyword._id))
    );
    if (filtered.length !== distributedKeywordIds.size) {
      throw new Error(
        `분산 루트 키워드 스냅샷 불일치: ${filtered.length}/${distributedKeywordIds.size}`
      );
    }
  }
  const normalize = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');

  if (onlyCompany)
    filtered = filtered.filter(
      (k) => normalize(k.company) === normalize(onlyCompany)
    );
  if (onlyKeywordRegex) {
    try {
      const re = new RegExp(onlyKeywordRegex);
      filtered = filtered.filter((k) => re.test(k.keyword));
    } catch (error) {
      logger.warn(`ONLY_KEYWORD_REGEX 무시: ${(error as Error).message}`);
    }
  }
  if (onlyId) {
    filtered = filtered.filter((k) => String(k._id) === onlyId);
  }

  const startIndexRaw = Number(process.env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexRaw)
    ? Math.max(0, Math.min(startIndexRaw, filtered.length))
    : 0;

  const keywords = filtered.slice(startIndex);
  const concurrency = getExposureConcurrency();
  const maxPages = getExposureMaxPages(1);
  logger.info(
    `📋 루트 키워드 ${keywords.length}개 처리 예정 (필터 applied, start=${startIndex})`
  );
  logger.info(
    `⚡ 키워드 동시 처리: 최대 ${concurrency}개 / 최대 ${maxPages}페이지`
  );
  logger.info('🔐 루트 판정 기준: 등록 블로그 계정 ID (업체명 검사 생략)');
  logger.blank();

  if (concurrency > 1 && maxPages > 1 && keywords.length > 0) {
    await launchBrowser();
  }

  const logBuilder = createDetailedLogBuilder();
  const useVendorFilter = ['true', '1', 'yes'].includes(
    String(process.env.ROOT_USE_VENDOR_FILTER ?? '').toLowerCase()
  );
  const matchByBlogIdOnly = !useVendorFilter;
  logger.info(
    matchByBlogIdOnly
      ? '🎯 루트 업체명 필터 생략: 등록 블로그 ID만으로 노출 판정'
      : '🎯 루트 업체명 필터 적용: 계정 ID와 업체명을 함께 확인'
  );

  const allResults = await processKeywords(keywords, logBuilder, {
    updateFunction: updateRootKeywordResult,
    isLoggedIn: loginStatus.isLoggedIn,
    maxPages,
    concurrency,
    blogIds: [...BLOG_IDS],
    allowAnyBlog: false,
    matchByBlogIdOnly,
    consumeMatches: false,
  });

  if (isDistributedShard) {
    logger.success(
      `[분산 루트] ${keywords.length}개 처리, ${allResults.length}개 노출 DB 반영 완료`
    );
    return;
  }

  const timestamp = getKSTTimestamp();
  const filename = `root_${timestamp}.csv`;
  saveToCSV(allResults, filename);
  saveToSheetCSV(
    keywords.map((k) => ({ keyword: k.keyword, company: k.company })),
    allResults,
    `root_sheet_${timestamp}.csv`
  );

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

  logger.summary.complete('루트 키워드 크롤링 완료 요약', [
    { label: '총 검색어', value: `${keywords.length}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
  ]);

  // 미노출 키워드 (변경=false인 것만)
  const exposedKeywords = new Set(allResults.map((r) => r.query));
  const missingKeywords = keywords
    .filter((k) => !exposedKeywords.has(k.keyword) && !k.isUpdateRequired)
    .map((k) => k.keyword);

  const rewriteResult = await rewriteOrderedResultSheet(
    'root',
    allResults,
    undefined,
    keywords.map((keyword) => ({
      keyword: keyword.keyword,
      company: keyword.company,
    }))
  );
  logger.info(`시트 반영 결과: ${rewriteResult.rowCount}건, 원본 순서 재조회 완료`);

  await sendDoorayExposureResult({
    cronType: '루트 키워드',
    totalKeywords: keywords.length,
    exposureCount: allResults.length,
    popularCount,
    sblCount,
    elapsedTime: elapsedTimeStr,
    missingKeywords,
  });

  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, `root_${timestamp}`, elapsedTimeStr);

  const stats = logBuilder.getStats();
  logger.summary.complete('상세 로그 저장 완료', [
    { label: '총 로그 엔트리', value: `${stats.total}개` },
    { label: '성공', value: `${stats.success}개` },
    { label: '실패', value: `${stats.failed}개` },
  ]);
};

export async function main(): Promise<void> {
  try {
    await runRootWorkflow();
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
