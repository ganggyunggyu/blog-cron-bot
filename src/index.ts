import * as dotenv from 'dotenv';
import { connectDB, disconnectDB, getAllKeywords } from './database';
import { saveToCSV, saveToSheetCSV } from './csv-writer';
import { getSheetOptions } from './sheet-config';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import { getKSTTimestamp } from './utils';
import { sendDoorayExposureResult } from './lib/dooray';
import { DOGMARU_BLOG_IDS } from './constants/blog-ids';
import { ExposureResult } from './matcher';

dotenv.config();

export async function main() {
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
    process.exit(1);
  }

  await connectDB(mongoUri);

  const allKeywords = await getAllKeywords();

  const onlySheetType = (process.env.ONLY_SHEET_TYPE || '').trim();
  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

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
  logger.blank();

  const logBuilder = createDetailedLogBuilder();

  const dogmaruKeywords = keywords.filter((k: any) => k.sheetType === 'dogmaru');
  const otherKeywords = keywords.filter((k: any) => k.sheetType !== 'dogmaru');

  const allResults: ExposureResult[] = [];

  if (otherKeywords.length > 0) {
    logger.info(`📦 패키지/일반건 ${otherKeywords.length}개 처리`);
    const results = await processKeywords(otherKeywords, logBuilder, {
      isLoggedIn: loginStatus.isLoggedIn,
    });
    allResults.push(...results);
  }

  if (dogmaruKeywords.length > 0) {
    logger.info(`🐕 도그마루 ${dogmaruKeywords.length}개 처리 (도그마루 계정 전용)`);
    const results = await processKeywords(dogmaruKeywords, logBuilder, {
      isLoggedIn: loginStatus.isLoggedIn,
      blogIds: DOGMARU_BLOG_IDS,
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
    `${csvPrefix}_sheet_${timestamp}.csv`
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

  logger.summary.complete('크롤링 완료 요약', [
    { label: '총 검색어', value: `${keywords.length}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
  ]);

  // 미노출 키워드 (변경=false인 것만)
  const exposedKeywords = new Set(allResults.map((r) => r.query));
  const missingKeywords = keywords
    .filter((k: any) => !exposedKeywords.has(k.keyword) && !k.isUpdateRequired)
    .map((k: any) => k.keyword);

  // Dooray 메시지 전송
  await sendDoorayExposureResult({
    cronType: '패키지 일반건 노출체크',
    totalKeywords: keywords.length,
    exposureCount: allResults.length,
    popularCount,
    sblCount,
    elapsedTime: elapsedTimeStr,
    missingKeywords,
  });

  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, timestamp, elapsedTimeStr);

  const stats = logBuilder.getStats();
  logger.summary.complete('상세 로그 저장 완료', [
    { label: '총 로그 엔트리', value: `${stats.total}개` },
    { label: '성공', value: `${stats.success}개` },
    { label: '실패', value: `${stats.failed}개` },
  ]);

  await disconnectDB();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
