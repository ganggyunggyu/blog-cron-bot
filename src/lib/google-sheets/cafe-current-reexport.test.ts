import assert from 'node:assert/strict';
import { buildCafeCurrentRows } from './cafe-current-reexport';

const rows = buildCafeCurrentRows(
  [
    ['업체명', '키워드'],
    ['업체A', '중복 키워드'],
    ['', ''],
    ['업체B', '중복 키워드'],
  ],
  [
    ['키워드', '노출여부', '순위', '카페블로그명', '링크', '카페계정'],
    ['중복 키워드', 'o', '1', '첫 결과', 'https://cafe.naver.com/1', '계정A'],
    ['', '', '', '', '', ''],
    ['중복 키워드', '', '', '둘째 결과', 'https://cafe.naver.com/2', ''],
  ]
);

assert.deepEqual(rows, [
  ['중복 키워드', 'o', '1', '첫 결과', 'https://cafe.naver.com/1', '계정A'],
  ['', '', '', '', '', ''],
  ['중복 키워드', '', '', '둘째 결과', 'https://cafe.naver.com/2', ''],
]);

process.stdout.write('cafe current reexport tests passed\n');
