import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const text = [
  '[더보기 노출체크 전체 완료] 2026-07-03 13:07 KST',
  '',
  '대상: 패키지_더보기 / 일반건_더보기 / 도그마루_더보기 / 루트_더보기 / 서리펫_더보기',
  '기준: 브라우저 모드 / 50위까지만 / all-matches / 외부 상위글 날짜 10개 / 루트 업체명 검증 포함',
  '',
  '- 패키지_더보기: 58키워드 / 결과 68행 / 노출 30행(20키워드) / 오류 0 / 50위 초과 0',
  '- 일반건_더보기: 48키워드 / 결과 75행 / 노출 58행(31키워드) / 오류 0 / 50위 초과 0',
  '- 도그마루_더보기: 46키워드 / 결과 153행 / 노출 149행(42키워드) / 오류 0 / 50위 초과 0',
  '- 루트_더보기: 131키워드 / 결과 149행 / 노출 63행(45키워드) / 오류 1 / 50위 초과 0',
  '  오류: 지웰시티맛집(창심관 지웰시티점) - 더보기 결과 0개',
  '- 서리펫_더보기: 18키워드 / 결과 64행 / 노출 62행(16키워드) / 오류 0 / 50위 초과 0',
  '',
  '전체: 301키워드 / 결과 509행 / 노출 362행(154키워드) / 오류 1 / 스크롤 상한 도달 0',
  '시트: https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit',
  '검증 JSON: output/old-logic-more-five-source-readback-2026-07-03T04-07-20-510Z.json',
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
