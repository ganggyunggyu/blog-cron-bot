import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import { main as runCrawl } from './index';

dotenv.config();

const SHEET_APP_URL = process.env.SHEET_APP_URL || 'http://localhost:3000';

const PRODUCT_SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';

const requests = [
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '패키지',
    sheetType: 'package',
  },
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '도그마루 제외',
    sheetType: 'dogmaru-exclude',
  },
  {
    sheetId: PRODUCT_SHEET_ID,
    sheetName: '도그마루',
    sheetType: 'dogmaru',
  },
] as {
  sheetId: string;
  sheetName: string;
  sheetType: string;
}[];

async function runCrawlingJob() {
  await runCrawl();
}

async function runFullWorkflow() {
  const startTime = new Date();
  console.log(`\n[${startTime.toLocaleString('ko-KR')}] 크론잡 시작`);

  try {
    console.log('\n[Step 1/3] DB동기화');

    const packageRes = await axios.post(
      `${SHEET_APP_URL}/api/keywords/sync`,
      requests[0]
    );
    const dgexRes = await axios.post(
      `${SHEET_APP_URL}/api/keywords/sync`,
      requests[1]
    );
    const dogRes = await axios.post(
      `${SHEET_APP_URL}/api/keywords/sync`,
      requests[2]
    );

    console.log('[Step 1/3] 완료:');

    console.log('\n[Step 2/3] 노출 체크 시작');
    await runCrawlingJob();
    console.log('[Step 2/3] 완료');

    console.log('\n[Step 3/3] 시트에 적용');

    const TEST_CONFIG = {
      SHEET_ID: '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0',
      SHEET_NAMES: {
        PACKAGE: '패키지 노출체크 프로그램',
        DOGMARU_EXCLUDE: '일반건 노출체크 프로그램',
        DOGMARU: '도그마루 노출체크 프로그램',
      },
      LABELS: {
        PACKAGE: '패키지 노출체크 프로그램',
        DOGMARU_EXCLUDE: '일반건 노출체크 프로그램',
        DOGMARU: '도그마루 노출체크 프로그램',
      },
    } as const;

    const packageImportRes = await axios.post(
      `${SHEET_APP_URL}/api/keywords/import`,
      {
        sheetId: TEST_CONFIG.SHEET_ID,
        sheetName: TEST_CONFIG.LABELS.PACKAGE,
        sheetType: TEST_CONFIG.SHEET_NAMES.PACKAGE,
        mode: 'rewrite',
      }
    );

    console.log(packageImportRes);
    console.log('[Step 3/3] 완료:', packageImportRes);
    console.log(`   - 업데이트: ${packageImportRes.data.updated || 0}개`);

    const dogExImportResponse = await axios.post(
      `${SHEET_APP_URL}/api/keywords/import`,
      {
        sheetId: TEST_CONFIG.SHEET_ID,
        sheetName: TEST_CONFIG.LABELS.DOGMARU_EXCLUDE,
        sheetType: TEST_CONFIG.SHEET_NAMES.DOGMARU_EXCLUDE,
        mode: 'rewrite',
      }
    );

    console.log('[Step 3/3] 완료:', dogExImportResponse);
    console.log(`   - 업데이트: ${dogExImportResponse.data.updated || 0}개`);

    const dogImportRes = await axios.post(
      `${SHEET_APP_URL}/api/keywords/import`,
      {
        sheetId: TEST_CONFIG.SHEET_ID,
        sheetName: TEST_CONFIG.LABELS.DOGMARU,
        sheetType: TEST_CONFIG.SHEET_NAMES.DOGMARU,
        mode: 'rewrite',
      }
    );

    console.log('[Step 3/3] 완료:', dogImportRes);
    console.log(`   - 업데이트: ${dogImportRes.data.updated || 0}개`);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log('\n' + '━'.repeat(60));
    console.log('[CRON] 전체 워크플로우 완료!');
    console.log(`시작 시간: ${startTime.toLocaleString('ko-KR')}`);
    console.log(`완료 시간: ${endTime.toLocaleString('ko-KR')}`);
    console.log(`소요 시간: ${duration.toFixed(1)}초`);
    console.log('━'.repeat(60) + '\n');
  } catch (error) {
    console.error('\n' + '━'.repeat(60));
    console.error('[CRON] 에러 발생:');

    if (axios.isAxiosError(error)) {
      console.error(`   - API 호출 실패: ${error.message}`);
      console.error(`   - URL: ${error.config?.url}`);
      if (error.response) {
        console.error(`   - 상태 코드: ${error.response.status}`);
        console.error(`   - 응답 데이터:`, error.response.data);
      }
    } else {
      console.error(`   - ${(error as Error).message}`);
    }

    console.error('━'.repeat(60) + '\n');
    throw error;
  }
}

let cronSchedule: string;
let scheduleDescription: string;

const testDelayMinutes = Number(process.env.TEST_DELAY_MINUTES || '0');

if (testDelayMinutes > 0) {
  const now = new Date();
  const targetTime = new Date(now.getTime() + testDelayMinutes * 60 * 1000);
  const minute = targetTime.getMinutes();
  const hour = targetTime.getHours();

  cronSchedule = `${minute} ${hour} * * *`;
  scheduleDescription = `테스트 모드: ${testDelayMinutes}분 뒤 (${targetTime.toLocaleTimeString(
    'ko-KR',
    { hour: '2-digit', minute: '2-digit' }
  )})`;
} else {
  cronSchedule = '0 8 * * *';
  scheduleDescription = '매일 오전 8시';
}

console.log('🚀 크론 스케줄러 시작');
console.log(`⏰ 스케줄: ${cronSchedule} (${scheduleDescription})`);
console.log(`📅 현재 시간: ${new Date().toLocaleString('ko-KR')}`);
console.log(`🌐 Sheet App URL: ${SHEET_APP_URL}`);

if (testDelayMinutes > 0) {
  const targetTime = new Date(Date.now() + testDelayMinutes * 60 * 1000);
  console.log(`🧪 테스트 실행 예정: ${targetTime.toLocaleString('ko-KR')}`);
}

console.log('⏳ 대기 중\n');

cron.schedule(
  cronSchedule,
  () => {
    runFullWorkflow();
  },
  {
    timezone: 'Asia/Seoul',
  }
);
