import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const text = [
  '[더보기 노출체크 전체 완료] 2026-07-07 08:06 KST',
  '',
  '대상: 패키지_더보기 / 일반건_더보기 / 도그마루_더보기 / 루트_더보기 / 서리펫_더보기',
  '기준: 브라우저 모드 / 50위까지만 / all-matches / 외부 상위글 날짜 10개 / 루트 업체명 검증 포함',
  '',
  '- 패키지_더보기: 58키워드 / 결과 79행 / 노출 48행(27키워드) / 오류 0 / 50위 초과 0',
  '- 일반건_더보기: 49키워드 / 결과 81행 / 노출 68행(36키워드) / 오류 1 / 50위 초과 0',
  '  오류: 발목인대파열 - 더보기 결과 0개',
  '- 도그마루_더보기: 46키워드 / 결과 165행 / 노출 160행(41키워드) / 오류 0 / 50위 초과 0',
  '- 루트_더보기: 131키워드 / 결과 146행 / 노출 52행(37키워드) / 오류 1 / 50위 초과 0',
  '  오류: 지웰시티맛집(창심관 지웰시티점) - 더보기 결과 0개',
  '- 서리펫_더보기: 19키워드 / 결과 65행 / 노출 61행(15키워드) / 오류 0 / 50위 초과 0',
  '',
  '전체: 303키워드 / 결과 536행 / 노출 389행(156키워드) / 오류 2 / 스크롤 상한 도달 0',
  '시트: https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit',
  '검증 JSON: output/old-logic-more-five-source-readback-2026-07-06T23-06-54-455Z.json',
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
