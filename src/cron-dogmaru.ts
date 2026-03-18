import * as dotenv from 'dotenv';
import os from 'os';
import { connectDB, disconnectDB, getAllKeywords } from './database';
import { saveToCSV, saveToSheetCSV } from './csv-writer';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import { getKSTTimestamp } from './utils';
import { sendDoorayExposureResult } from './lib/dooray';
import { DOGMARU_BLOG_IDS } from './constants/blog-ids';
import { syncKeywords, importKeywords } from './api';
import { requests, importRes } from './constants';
import { ExposureResult } from './matcher';

dotenv.config();

const formatDuration = (ms: number): string => {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min > 0) return `${min}분 ${sec % 60}초`;
  return `${sec}초`;
};

const runDogmaruWorkflow = async () => {
  const startTime = Date.now();

  logger.summary.start('DOGMARU CRON START', [
    { label: '시작', value: new Date().toLocaleString('ko-KR') },
    { label: 'OS', value: `${os.platform()} (${os.arch()})` },
  ]);

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

  // 도그마루 시트만 동기화
  logger.step(1, 3, '도그마루 시트 동기화');
  await syncKeywords(requests[2]);
  logger.step(1, 3, '도그마루 시트 동기화', 'done');

  // 도그마루 키워드만 필터
  const allKeywords = await getAllKeywords();
  const dogmaruKeywords = allKeywords.filter(
    (k: any) => k.sheetType === 'dogmaru'
  );

  logger.info(`🐕 도그마루 키워드 ${dogmaruKeywords.length}개 처리 예정`);
  logger.blank();

  if (dogmaruKeywords.length === 0) {
    logger.warn('도그마루 키워드가 없습니다.');
    await disconnectDB();
    return;
  }

  // 노출 체크
  logger.step(2, 3, '도그마루 노출 체크');
  const logBuilder = createDetailedLogBuilder();
  const results: ExposureResult[] = await processKeywords(
    dogmaruKeywords,
    logBuilder,
    {
      isLoggedIn: loginStatus.isLoggedIn,
      blogIds: DOGMARU_BLOG_IDS,
    }
  );
  logger.step(2, 3, '도그마루 노출 체크', 'done');

  // 시트 반영
  logger.step(3, 3, '도그마루 시트 반영');
  const dogmaruImportRes = await importKeywords(importRes[2]);
  logger.result('도그마루', `${dogmaruImportRes.updated || 0}건`);
  logger.step(3, 3, '도그마루 시트 반영', 'done');

  // CSV 저장
  const timestamp = getKSTTimestamp();
  saveToCSV(results, `results-dogmaru_${timestamp}.csv`);
  saveToSheetCSV(
    dogmaruKeywords.map((k: any) => ({
      keyword: k.keyword,
      company: k.company,
    })),
    results,
    `results-dogmaru_sheet_${timestamp}.csv`
  );

  // 통계
  const elapsedMs = Date.now() - startTime;
  const elapsedTimeStr = formatDuration(elapsedMs);
  const popularCount = results.filter((r) => r.exposureType === '인기글').length;
  const sblCount = results.filter((r) => r.exposureType === '스블').length;

  logger.summary.complete('DOGMARU CRON COMPLETE', [
    { label: '총 검색어', value: `${dogmaruKeywords.length}개` },
    { label: '총 노출 발견', value: `${results.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
    { label: '시트 업데이트', value: `${dogmaruImportRes.updated || 0}건` },
  ]);

  // 미노출 키워드
  const exposedKeywords = new Set(results.map((r) => r.query));
  const missingKeywords = dogmaruKeywords
    .filter(
      (k: any) => !exposedKeywords.has(k.keyword) && !k.isUpdateRequired
    )
    .map((k: any) => k.keyword);

  // Dooray 메시지
  await sendDoorayExposureResult({
    cronType: '도그마루 노출체크',
    totalKeywords: dogmaruKeywords.length,
    exposureCount: results.length,
    popularCount,
    sblCount,
    elapsedTime: elapsedTimeStr,
    missingKeywords,
  });

  // 상세 로그 저장
  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, timestamp, elapsedTimeStr);

  await disconnectDB();
};

runDogmaruWorkflow().catch((error) => {
  logger.error(`도그마루 크론 오류: ${(error as Error).message}`);
  process.exit(1);
});
