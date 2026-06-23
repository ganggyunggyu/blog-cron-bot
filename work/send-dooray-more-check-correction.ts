import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const text = [
  '[더보기 노출체크 재실행 완료] 2026-06-23 16:12 KST',
  '',
  '기준: 패키지/일반건 브라우저 모드, 50위까지만, 업체명 검증 없음, PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS 135개',
  '',
  '- 패키지_더보기: 58키워드 / 결과 94행 / 노출 71행(35키워드) / 오류 0 / 50위 초과 0',
  '  주요: 위고비 알약 i_thinkkkk 3위, 8위 / surreal805 12위',
  '- 일반건_더보기: 50키워드 / 결과 55행 / 노출 24행(19키워드) / 오류 0 / 50위 초과 0',
  '  주요: 프로포즈반지 solantoro 4위 https://m.blog.naver.com/solantoro/224315978263',
  '',
  '시트: https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit',
  '검증 JSON: output/old-logic-more-package-general-top50-browser-135-readback-2026-06-23T07-12-04-979Z.json',
].join('\n');

const main = async (): Promise<void> => {
  const ok = await sendDoorayMessage(text, '노출체크봇');
  process.stdout.write(`dooray: ${ok ? 'OK' : 'FAIL'}\n`);
  if (!ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
