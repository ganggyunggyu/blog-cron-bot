import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const text = [
  '[더보기 노출체크 전체 완료] 2026-07-06 08:55 KST',
  '',
  '대상: 패키지_더보기 / 일반건_더보기 / 도그마루_더보기 / 루트_더보기 / 서리펫_더보기',
  '기준: 브라우저 모드 / 50위까지만 / all-matches / 외부 상위글 날짜 10개 / 루트 업체명 검증 포함',
  '',
  '- 패키지_더보기: 58키워드 / 결과 76행 / 노출 44행(26키워드) / 오류 0 / 50위 초과 0',
  '- 일반건_더보기: 48키워드 / 결과 81행 / 노출 69행(36키워드) / 오류 0 / 50위 초과 0',
  '- 도그마루_더보기: 46키워드 / 결과 164행 / 노출 160행(42키워드) / 오류 0 / 50위 초과 0',
  '- 루트_더보기: 131키워드 / 결과 144행 / 노출 51행(38키워드) / 오류 1 / 50위 초과 0',
  '  오류: 지웰시티맛집(창심관 지웰시티점) - 더보기 결과 0개',
  '- 서리펫_더보기: 18키워드 / 결과 67행 / 노출 65행(16키워드) / 오류 0 / 50위 초과 0',
  '',
  '전체: 301키워드 / 결과 532행 / 노출 389행(158키워드) / 오류 1 / 스크롤 상한 도달 0',
  '시트: https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit',
  '검증 JSON: output/old-logic-more-five-source-readback-2026-07-05T23-55-41-408Z.json',
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
