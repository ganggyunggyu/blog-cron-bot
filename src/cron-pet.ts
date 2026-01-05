import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllKeywords,
  updateKeywordResult,
  IKeyword,
} from './database';
import { saveToCSV } from './csv-writer';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { PRODUCT_SHEET_ID, TEST_CONFIG, SHEET_TYPE, SHEET_APP_URL } from './constants';
import { syncKeywords } from './api';
import axios from 'axios';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';

dotenv.config();

const PET_COMPANIES = ['도그마루', '서리펫'];

export async function main() {
  const startTime = Date.now();

  logger.divider('🐾 펫 전용 크론 (도그마루/서리펫)');

  const loginStatus = await checkNaverLogin();
  logger.divider('로그인 상태');
  if (loginStatus.isLoggedIn) {
    logger.success(`🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`);
  } else {
    logger.info('🌐 비로그인 모드');
  }
  logger.blank();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    const syncResult = await syncKeywords({
      sheetId: PRODUCT_SHEET_ID,
      sheetName: '도그마루',
      sheetType: SHEET_TYPE.DOGMARU,
    });
    logger.success(`도그마루 시트 동기화 완료! ${JSON.stringify(syncResult)}`);
  } catch (error) {
    logger.error(`동기화 에러: ${(error as Error).message}`);
  }

  await connectDB(mongoUri);

  const allKeywords = await getAllKeywords();

  const normalize = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');

  let filtered = (allKeywords as IKeyword[]).filter((k) =>
    PET_COMPANIES.some((pet) => normalize(k.company) === normalize(pet))
  );

  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

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

  const dogmaruCount = keywords.filter((k) => normalize(k.company) === '도그마루').length;
  const seoripetCount = keywords.filter((k) => normalize(k.company) === '서리펫').length;

  logger.info(`🐕 도그마루: ${dogmaruCount}개`);
  logger.info(`🐈 서리펫: ${seoripetCount}개`);
  logger.info(`📋 총 ${keywords.length}개 펫 키워드 처리 예정 (start=${startIndex})`);
  logger.blank();

  if (keywords.length === 0) {
    logger.warn('처리할 펫 키워드가 없습니다.');
    await disconnectDB();
    return;
  }

  const logBuilder = createDetailedLogBuilder();

  const allResults = await processKeywords(keywords, logBuilder, {
    updateFunction: updateKeywordResult,
    isLoggedIn: loginStatus.isLoggedIn,
    maxPages: 4,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `pet_${timestamp}.csv`;
  saveToCSV(allResults, filename);

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

  const popularCount = allResults.filter((r) => r.exposureType === '인기글').length;
  const sblCount = allResults.filter((r) => r.exposureType === '스블').length;

  logger.summary.complete('🐾 펫 키워드 크롤링 완료 요약', [
    { label: '총 검색어', value: `${keywords.length}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
  ]);

  try {
    const importResult = await axios.post(`${SHEET_APP_URL}/api/keywords/pet`, {
      sheetId: TEST_CONFIG.SHEET_ID,
      sheetName: '애견',
    });
    logger.info(`시트 반영 결과: ${JSON.stringify(importResult.data)}`);
  } catch (error) {
    logger.error(`시트 반영 에러: ${(error as Error).message}`);
  }

  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, `pet_${timestamp}`, elapsedTimeStr);

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
