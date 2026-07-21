import assert from 'node:assert/strict';
import { buildCafeScheduleExportRows } from './index';

const rows = buildCafeScheduleExportRows(
  [
    { row: 10, keyword: '나비약' },
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
  },
  { 키워드: '', 노출여부: '', 순위: '', 카페블로그명: '', 링크: '' },
  { 키워드: '나비약', 노출여부: '', 순위: '', 카페블로그명: '', 링크: '' },
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

process.stdout.write('cafe schedule export tests passed\n');
