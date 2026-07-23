import assert from 'node:assert/strict';
import { buildCafeSourceMirrorRows } from '.';

const rows = buildCafeSourceMirrorRows(
  [
    ['업체명', '키워드'],
    ['업체A', '중복'],
    ['', ''],
    ['업체B', '중복'],
    ['', ' 끝 공백 '],
    ['', ''],
  ],
  [
    ['키워드', '노출여부', '순위', '카페블로그명', '링크', '카페계정'],
    ['중복', '', '', '', '', '계정1'],
    ['중복', '', '', '', '', '계정2'],
  ]
);

assert.deepEqual(rows, [
  { rawKeyword: '중복', keyword: '중복', cafeAccount: '계정1' },
  { rawKeyword: '', keyword: '', cafeAccount: '' },
  { rawKeyword: '중복', keyword: '중복', cafeAccount: '계정2' },
  { rawKeyword: ' 끝 공백 ', keyword: '끝 공백', cafeAccount: '' },
]);

process.stdout.write('cafe source mirror tests passed\n');

