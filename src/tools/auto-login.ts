import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { checkNaverLogin } from '../lib/check-naver-login';

const ENV_PATH = path.resolve(__dirname, '../../.env');

const updateEnvFile = (nidAut: string, nidSes: string): void => {
  let envContent = fs.readFileSync(ENV_PATH, 'utf-8');

  envContent = envContent.replace(/NAVER_NID_AUT=.*/, `NAVER_NID_AUT=${nidAut}`);
  envContent = envContent.replace(/NAVER_NID_SES=.*/, `NAVER_NID_SES=${nidSes}`);

  fs.writeFileSync(ENV_PATH, envContent);
};

export const autoLogin = async (): Promise<boolean> => {
  const naverId = process.env.NAVER_ID;
  const naverPw = process.env.NAVER_PW;

  if (!naverId || !naverPw) {
    console.log('❌ NAVER_ID 또는 NAVER_PW가 .env에 설정되지 않았어.');
    process.exit(1);
  }

  console.log('\n🔐 네이버 자동 로그인 시작\n');
  console.log(`계정: ${naverId}`);

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
  });

  const page = await context.newPage();
  let isLoggedIn = false;

  try {
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.waitForTimeout(1000);

    // 아이디 입력 (JavaScript 실행으로 입력 - 네이버 봇 감지 우회)
    await page.evaluate((id) => {
      const input = document.querySelector('#id') as HTMLInputElement;
      if (input) input.value = id;
    }, naverId);

    await page.waitForTimeout(500);

    // 비밀번호 입력
    await page.evaluate((pw) => {
      const input = document.querySelector('#pw') as HTMLInputElement;
      if (input) input.value = pw;
    }, naverPw);

    await page.waitForTimeout(500);

    // 로그인 버튼 클릭
    await page.click('.btn_login');

    console.log('⏳ 로그인 처리 중...\n');

    // 로그인 완료 대기 (최대 30초)
    let attempts = 0;
    const maxAttempts = 30;

    while (!isLoggedIn && attempts < maxAttempts) {
      await page.waitForTimeout(1000);
      attempts++;

      const cookies = await context.cookies();
      const nidSes = cookies.find((c) => c.name === 'NID_SES');
      const nidAut = cookies.find((c) => c.name === 'NID_AUT');

      if (nidSes && nidAut) {
        isLoggedIn = true;
        console.log('✅ 로그인 성공!\n');

        updateEnvFile(nidAut.value, nidSes.value);

        console.log('✅ 쿠키 업데이트 완료!');
        console.log(`NID_AUT: ${nidAut.value.slice(0, 20)}...`);
        console.log(`NID_SES: ${nidSes.value.slice(0, 20)}...\n`);

        // 환경변수 갱신
        process.env.NAVER_NID_AUT = nidAut.value;
        process.env.NAVER_NID_SES = nidSes.value;

        // 로그인 유효성 검증
        console.log('🔍 로그인 유효성 검증 중...\n');
        const status = await checkNaverLogin();
        if (status.isLoggedIn) {
          console.log(`✅ 로그인 확인됨! (${status.userName})`);
          if (status.email) {
            console.log(`   이메일: ${status.email}`);
          }
        } else {
          console.log('⚠️ 쿠키는 저장됐지만 로그인 확인 실패');
        }
        console.log('');
      }

      // 캡차나 2단계 인증 감지
      const currentUrl = page.url();
      if (currentUrl.includes('captcha') || currentUrl.includes('protect')) {
        console.log('⚠️ 캡차 또는 보안 인증이 필요해. 수동으로 처리해줘.\n');
        console.log('인증 완료 후 자동으로 쿠키를 추출할게.\n');
      }
    }

    if (!isLoggedIn) {
      console.log('❌ 로그인 실패 또는 시간 초과\n');
      console.log('캡차가 필요하거나 계정 정보가 틀렸을 수 있어.\n');
    }
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await browser.close();
  }

  return isLoggedIn;
};

// CLI 직접 실행 시
if (require.main === module) {
  autoLogin()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
