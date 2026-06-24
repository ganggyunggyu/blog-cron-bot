import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const text = [
  '[더보기 노출체크 전체 완료] 2026-06-24 10:16 KST',
  '',
  '기준: 브라우저 모드 / 50위까지만 / 패키지·일반건·도그마루 업체명 검증 없음 / 루트 업체명 검증 포함',
  '',
  '- 패키지_더보기: 58키워드 / 결과 91행 / 노출 68행(35키워드) / 오류 0 / 50위 초과 0',
  '  주요: 위고비 알약 i_thinkkkk 1위, 6위 / surreal805 10위',
  '- 일반건_더보기: 51키워드 / 결과 57행 / 노출 28행(22키워드) / 오류 0 / 50위 초과 0',
  '  주요: 프로포즈반지 solantoro 4위',
  '- 도그마루_더보기: 47키워드 / 결과 152행 / 노출 146행(41키워드) / 오류 0 / 50위 초과 0',
  '- 루트_더보기: 128키워드 / 결과 146행 / 노출 47행(29키워드) / 오류 1 / 50위 초과 0',
  '  주요: 광안리맛집(청산1954 광안리본점) dreamclock33 5위',
  '  오류: 지웰시티맛집(창심관 지웰시티점) - 더보기 결과 0개',
  '',
  '시트: https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit',
  '검증 JSON: output/old-logic-more-all-top50-browser-readback-2026-06-24T01-16-32-810Z.json',
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
