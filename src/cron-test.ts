import * as dotenv from 'dotenv';
import { saveToCSV, saveToSheetCSV } from './csv-writer';
import { createDetailedLogBuilder } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { checkNaverLogin } from './lib/check-naver-login';
import { logger } from './lib/logger';
import { closeBrowser } from './lib/playwright-crawler';
import { getKSTTimestamp } from './utils';
import { ExposureResult } from './matcher';
import { PAGES_BLOG_IDS } from './constants/blog-ids';

dotenv.config();

const TEST_KEYWORDS = [
  // 안과/라식
  '스마일라식', '라식', '투데이라섹', '스마일라식 비용', '백내장수술',
  '백내장수술비용', '렌즈삽입술', '렌즈삽입술 가격', '안구건조증치료',
  '라섹', '스마일라식 가격', '라식라섹',
];

async function main() {
  const startTime = Date.now();

  logger.divider('🧪 테스트 노출체크');

  const loginStatus = await checkNaverLogin();
  logger.divider('로그인 상태');
  if (loginStatus.isLoggedIn) {
    logger.success(`🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`);
  } else {
    logger.info('🌐 비로그인 모드');
  }
  logger.blank();

  // 키워드를 IKeyword 형태로 변환
  const keywords = TEST_KEYWORDS.map((keyword, idx) => ({
    _id: `test-${idx}`,
    keyword,
    company: '테스트',
  }));

  logger.info(`📋 총 ${keywords.length}개 키워드 로드`);
  logger.blank();

  const logBuilder = createDetailedLogBuilder();
  const allResults: ExposureResult[] = [];

  // 더미 업데이트 함수 (DB 업데이트 안함)
  const dummyUpdate = async () => {};

  logger.divider('노출체크 시작');
  const results = await processKeywords(keywords as any, logBuilder, {
    updateFunction: dummyUpdate,
    isLoggedIn: loginStatus.isLoggedIn,
    maxPages: 9,
    blogIds: PAGES_BLOG_IDS,
  });

  allResults.push(...results);

  // CSV 저장
  const timestamp = getKSTTimestamp();
  const filename = `test_keywords_${timestamp}.csv`;
  saveToCSV(allResults, filename);

  // 시트 형식 CSV (미노출 포함)
  saveToSheetCSV(
    keywords.map((k) => ({ keyword: k.keyword, company: k.company })),
    allResults,
    `test_keywords_sheet_${timestamp}.csv`
  );

  // 결과 요약
  const elapsedMs = Date.now() - startTime;
  const minutes = Math.floor(elapsedMs / (1000 * 60));
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
  const elapsedTimeStr = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;

  logger.blank();
  logger.summary.complete('🧪 테스트 노출체크 완료', [
    { label: '총 키워드', value: `${keywords.length}개` },
    { label: '노출 발견', value: `${allResults.length}개` },
    { label: '소요 시간', value: elapsedTimeStr },
    { label: '결과 파일', value: `output/${filename}` },
  ]);

  await closeBrowser();
  process.exit(0);
}

main().catch((error) => {
  logger.error(`프로그램 오류: ${(error as Error).message}`);
  process.exit(1);
});
