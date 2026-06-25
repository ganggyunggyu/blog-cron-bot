import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const text = [
  '[더보기 노출체크 순차 완료] 2026-06-25 11:11 KST',
  '',
  '순서: 루트 -> 패키지 -> 일반건 -> 도그마루',
  '기준: 브라우저 모드 / 50위까지만 / 패키지·일반건·도그마루 업체명 검증 없음 / 루트 업체명 검증 포함',
  '',
  '- 루트_더보기: 129키워드 / 결과 149행 / 노출 51행(31키워드) / 오류 1 / 50위 초과 0',
  '  주요: 광안리맛집(청산1954 광안리본점) dreamclock33 39위',
  '  오류: 지웰시티맛집(창심관 지웰시티점) - 더보기 결과 0개',
  '- 패키지_더보기: 58키워드 / 결과 99행 / 노출 79행(38키워드) / 오류 0 / 50위 초과 0',
  '  주요: 위고비 알약 i_thinkkkk 1위, 2위 / surreal805 22위',
  '- 일반건_더보기: 52키워드 / 결과 54행 / 노출 25행(23키워드) / 오류 0 / 50위 초과 0',
  '  주요: 프로포즈반지 solantoro 5위',
  '- 도그마루_더보기: 48키워드 / 결과 155행 / 노출 149행(42키워드) / 오류 0 / 50위 초과 0',
  '',
  '시트: https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit',
  '검증 JSON: output/old-logic-more-all-top50-browser-readback-2026-06-25T02-11-39-264Z.json',
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
