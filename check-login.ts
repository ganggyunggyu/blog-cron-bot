import 'dotenv/config';
import { checkNaverLogin } from './src/lib/check-naver-login';

async function main() {
  const nidAut = process.env.NAVER_NID_AUT;
  const nidSes = process.env.NAVER_NID_SES;
  const mLoc = process.env.NAVER_M_LOC;

  console.log('=== 쿠키 설정 상태 ===');
  console.log('NID_AUT:', nidAut ? '✅ 설정됨' : '❌ 없음');
  console.log('NID_SES:', nidSes ? '✅ 설정됨' : '❌ 없음');
  console.log('m_loc:', mLoc ? '✅ 설정됨' : '❌ 없음');
  console.log('');

  console.log('=== 로그인 상태 확인 ===');
  const status = await checkNaverLogin();

  if (status.isLoggedIn) {
    console.log(`✅ 로그인 확인됨! (${status.userName})`);
    if (status.email) {
      console.log(`   이메일: ${status.email}`);
    }
  } else {
    console.log('❌ 비로그인 상태');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
