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

assert.throws(
  () =>
    buildCafeScheduleExportRows(
      [{ row: 10, keyword: '원본' }],
      [
        {
          row: 10,
          keyword: '다른값',
          exposureStatus: '노출',
          rank: '1',
          name: '카페A',
          links: 'https://example.com/a',
        },
      ]
    ),
  /키워드 불일치/
);

process.stdout.write('cafe schedule export tests passed\n');
