import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import { main as runCrawl } from './index';

dotenv.config();

// Sheet App URL (환경변수로 설정 가능)
const SHEET_APP_URL = process.env.SHEET_APP_URL || 'http://localhost:3000';

// Step 2: 노출 체크는 index.ts의 main을 그대로 사용
async function runCrawlingJob() {
  await runCrawl();
}

// 전체 워크플로우 (3단계)
async function runFullWorkflow() {
  const startTime = new Date();
  console.log(`\n🤖 [${startTime.toLocaleString('ko-KR')}] 크론잡 시작`);
  console.log('━'.repeat(60));

  try {
    // Step 1: 전체 데이터 DB로 내보내기 (Sheet → DB)
    console.log('\n📤 [Step 1/3] 전체 데이터 DB로 내보내기...');
    console.log(`   API: ${SHEET_APP_URL}/api/cron/sync-all`);

    const syncResponse = await axios.get(`${SHEET_APP_URL}/api/cron/sync-all`, {
      timeout: 60000, // 60초 타임아웃
    });

    console.log('✅ [Step 1/3] 완료:', syncResponse.data);
    console.log(`   - 삭제: ${syncResponse.data.totals?.deleted || 0}개`);
    console.log(`   - 삽입: ${syncResponse.data.totals?.inserted || 0}개`);

    // Step 2: 크롤링 + 노출 체크
    console.log('\n🔍 [Step 2/3] 크롤링 및 노출 체크 시작...');
    await runCrawlingJob();
    console.log('✅ [Step 2/3] 완료');

    // Step 3: 적용된 노출 현황 전체 적용 (DB → Sheet)
    console.log('\n📥 [Step 3/3] 노출 현황 시트에 적용...');
    console.log(`   API: ${SHEET_APP_URL}/api/cron/import-all`);

    // const importResponse = await axios.get(`${SHEET_APP_URL}/api/cron/import-all`, {
    //   timeout: 60000, // 60초 타임아웃
    // });

    // console.log('✅ [Step 3/3] 완료:', importResponse.data);
    // console.log(`   - 업데이트: ${importResponse.data.updated || 0}개`);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log('\n' + '━'.repeat(60));
    console.log('✅ [CRON] 전체 워크플로우 완료!');
    console.log(`🕐 시작 시간: ${startTime.toLocaleString('ko-KR')}`);
    console.log(`🕐 완료 시간: ${endTime.toLocaleString('ko-KR')}`);
    console.log(`⏱️  소요 시간: ${duration.toFixed(1)}초`);
    console.log('━'.repeat(60) + '\n');
  } catch (error) {
    console.error('\n' + '━'.repeat(60));
    console.error('❌ [CRON] 에러 발생:');

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

// 크론 스케줄 설정
let cronSchedule: string;
let scheduleDescription: string;

// 테스트 모드: 현재 시간 + N분 뒤 실행
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
  // 프로덕션 모드: 매일 오전 8시
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

console.log('⏳ 대기 중...\n');

// 크론 작업 등록
cron.schedule(
  cronSchedule,
  () => {
    runFullWorkflow();
  },
  {
    timezone: 'Asia/Seoul',
  }
);
