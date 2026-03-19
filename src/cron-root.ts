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
import { ROOT_CONFIG, SHEET_APP_URL } from './constants';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import axios from 'axios';
import { getKSTTimestamp } from './utils';
import { sendDoorayExposureResult } from './lib/dooray';
import { autoLogin } from './tools/auto-login';

dotenv.config();

export async function main() {
  const startTime = Date.now();

  let loginStatus = await checkNaverLogin();
  logger.divider('로그인 상태');
  if (!loginStatus.isLoggedIn) {
    logger.warn('🔑 로그인 필요, 자동 로그인 시도...');
    const loginSuccess = await autoLogin();
    if (!loginSuccess) {
      logger.error('❌ 자동 로그인 실패');
      process.exit(1);
    }
    loginStatus = await checkNaverLogin();
  }

  if (loginStatus.isLoggedIn) {
    logger.success(
      `🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`
    );
  } else {
    logger.error('❌ 로그인 확인 실패');
    process.exit(1);
  }
  logger.blank();

  type RootResponseType = { deleted: number; inserted: number };
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    const response = await fetch(`${SHEET_APP_URL}/api/root-keywords/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetId: ROOT_CONFIG.SHEET_ID }),
    });

    const result = (await response.json()) as RootResponseType;
    logger.success(
      `DB 동기화 완료! (삭제: ${result.deleted}, 삽입: ${result.inserted})`
    );
  } catch (error) {
    logger.error(`동기화 에러: ${(error as Error).message}`);
  }

  await connectDB(mongoUri);

  const allKeywords = await getAllRootKeywords();

  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

  let filtered = allKeywords as IRootKeyword[];
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
    } catch {}
  }
  if (onlyId) {
    filtered = filtered.filter((k) => String(k._id) === onlyId);
  }

  const startIndexRaw = Number(process.env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexRaw)
    ? Math.max(0, Math.min(startIndexRaw, filtered.length))
    : 0;

  const keywords = filtered.slice(startIndex);
  logger.info(
    `📋 루트 키워드 ${keywords.length}개 처리 예정 (필터 applied, start=${startIndex})`
  );
  logger.blank();

  const logBuilder = createDetailedLogBuilder();

  const allResults = await processKeywords(keywords, logBuilder, {
    updateFunction: updateRootKeywordResult,
    isLoggedIn: loginStatus.isLoggedIn,
    allowAnyBlog: true,
  });

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

  await sendDoorayExposureResult({
    cronType: '루트 키워드',
    totalKeywords: keywords.length,
    exposureCount: allResults.length,
    popularCount,
    sblCount,
    elapsedTime: elapsedTimeStr,
    missingKeywords,
  });

  const result = await axios.post(`${SHEET_APP_URL}/api/root-keywords/import`);
  logger.info(`시트 반영 결과: ${JSON.stringify(result.data)}`);

  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, `root_${timestamp}`, elapsedTimeStr);

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
