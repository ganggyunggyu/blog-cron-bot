import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const text = [
  '[더보기 노출체크 전체 완료] 2026-07-01 11:53 KST',
  '',
  '대상: 패키지_더보기 / 일반건_더보기 / 도그마루_더보기 / 루트_더보기 / 서리펫_더보기',
  '기준: 브라우저 모드 / 50위까지만 / all-matches / 외부 상위글 날짜 10개 / 루트 업체명 검증 포함',
  '',
  '- 패키지_더보기: 59키워드 / 결과 66행 / 노출 23행(16키워드) / 오류 0 / 50위 초과 0',
  '- 일반건_더보기: 50키워드 / 결과 74행 / 노출 53행(29키워드) / 오류 0 / 50위 초과 0',
  '- 도그마루_더보기: 46키워드 / 결과 155행 / 노출 150행(41키워드) / 오류 0 / 50위 초과 0',
  '- 루트_더보기: 130키워드 / 결과 142행 / 노출 45행(33키워드) / 오류 1 / 50위 초과 0',
  '  오류: 지웰시티맛집(창심관 지웰시티점) - 더보기 결과 0개',
  '- 서리펫_더보기: 18키워드 / 결과 57행 / 노출 54행(15키워드) / 오류 0 / 50위 초과 0',
  '',
  '전체: 303키워드 / 결과 494행 / 노출 325행(134키워드) / 오류 1 / 스크롤 상한 도달 0',
  '시트: https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit',
  '검증 JSON: output/old-logic-more-five-source-readback-2026-07-01T02-53-32-587Z.json',
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
