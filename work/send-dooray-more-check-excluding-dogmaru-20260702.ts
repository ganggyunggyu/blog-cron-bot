import * as dotenv from 'dotenv';
import { sendDoorayMessage } from '../src/lib/dooray';

dotenv.config();

const sheetUrl =
  'https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit';
const readbackPath =
  'output/old-logic-more-excluding-dogmaru-readback-2026-07-02T07-08-06-349Z.json';

const text = [
  '[더보기 노출체크 완료] 2026-07-02 16:08 KST',
  '',
  '대상: 패키지_더보기 / 일반건_더보기 / 루트_더보기 / 서리펫_더보기 (도그마루 제외)',
  '기준: 브라우저 모드 / 50위까지만 / all-matches / 외부 상위글 날짜 10개 / 루트 업체명 검증 포함',
  '',
  '- 패키지_더보기: 59키워드 / 결과 72행 / 노출 38행(25키워드) / 오류 0 / 50위 초과 0',
  '- 일반건_더보기: 48키워드 / 결과 71행 / 노출 51행(28키워드) / 오류 0 / 50위 초과 0',
  '- 루트_더보기: 130키워드 / 결과 146행 / 노출 66행(50키워드) / 오류 1 / 50위 초과 0',
  '  오류: 지웰시티맛집(창심관 지웰시티점) - 더보기 결과 0개',
  '- 서리펫_더보기: 18키워드 / 결과 65행 / 노출 63행(16키워드) / 오류 0 / 50위 초과 0',
  '',
  '전체: 255키워드 / 결과 354행 / 노출 218행(119키워드) / 미노출·오류 136행 / 오류 1 / 스크롤 상한 도달 0',
  `시트: ${sheetUrl}`,
  `검증 JSON: ${readbackPath}`,
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
