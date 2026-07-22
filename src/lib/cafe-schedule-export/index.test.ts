import assert from 'node:assert/strict';
import {
  buildCafeScheduleExportRows,
  extractLatestCafeScheduleSourceRows,
} from './index';

const sourceRows = extractLatestCafeScheduleSourceRows([
  ['260701 스케줄'],
  ['이전 키워드'],
  [],
  ['260714 스케줄'],
  ['회사 답례품', '', '햄부기'],
  [],
  ['회사 답례품', '', '가중건다'],
  ['sat학원 '],
  [],
  [],
]);
assert.deepEqual(sourceRows, [
  { row: 5, keyword: '회사 답례품', cafeAccount: '햄부기' },
  { row: 6, keyword: '', cafeAccount: '' },
  { row: 7, keyword: '회사 답례품', cafeAccount: '가중건다' },
  { row: 8, keyword: 'sat학원 ', cafeAccount: '' },
]);

const rows = buildCafeScheduleExportRows(
  [
    { row: 10, keyword: '나비약', cafeAccount: '계정A' },
    { row: 11, keyword: '' },
    { row: 12, keyword: '나비약' },
  ],
  [
    {
      row: 10,
      keyword: '나비약',
      exposureStatus: '노출',
      rank: '1',
      name: '카페A',
      links: 'https://example.com/a',
    },
    {
      row: 12,
      keyword: '나비약',
      exposureStatus: '미노출',
      rank: '',
      name: '',
      links: '',
    },
  ]
);

assert.deepEqual(rows, [
  {
    키워드: '나비약',
    노출여부: 'o',
    순위: '1',
    카페블로그명: '카페A',
    링크: 'https://example.com/a',
    카페계정: '계정A',
  },
  {
    키워드: '',
    노출여부: '',
    순위: '',
    카페블로그명: '',
    링크: '',
    카페계정: '',
  },
  {
    키워드: '나비약',
    노출여부: '',
    순위: '',
    카페블로그명: '',
    링크: '',
    카페계정: '',
  },
]);

const reorderedRows = buildCafeScheduleExportRows(
  [
    { row: 20, keyword: '둘째' },
    { row: 21, keyword: '' },
    { row: 22, keyword: '첫째' },
  ],
  [
    {
      row: 10,
      keyword: '첫째',
      exposureStatus: '미노출',
      rank: '',
      name: '',
      links: '',
    },
    {
      row: 11,
      keyword: '둘째',
      exposureStatus: '노출',
      rank: '2',
      name: '카페B',
      links: 'https://example.com/b',
    },
  ]
);
assert.deepEqual(reorderedRows.map((row) => row.키워드), ['둘째', '', '첫째']);
assert.equal(reorderedRows[0].링크, 'https://example.com/b');

const whitespaceRows = buildCafeScheduleExportRows(
  [{ row: 97, keyword: 'sat학원 ' }],
  [
    {
      row: 97,
      keyword: 'sat학원',
      exposureStatus: '미노출',
      rank: '',
      name: '',
      links: '',
    },
  ]
);
assert.equal(whitespaceRows[0].키워드, 'sat학원 ');

const repeatedRows = buildCafeScheduleExportRows(
  [
    { row: 2, keyword: '대구사진관' },
    { row: 12, keyword: '대구사진관' },
  ],
  [
    {
      row: 2,
      keyword: '대구사진관',
      exposureStatus: '노출',
      rank: '3',
      name: '카페C',
      links: 'https://example.com/c',
    },
  ],
  true
);
assert.deepEqual(repeatedRows.map((row) => row.노출여부), ['o', 'o']);
assert.deepEqual(repeatedRows.map((row) => row.순위), ['3', '3']);

process.stdout.write('cafe schedule export tests passed\n');
