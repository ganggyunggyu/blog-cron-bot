import assert from 'node:assert/strict';
import { buildCafeExposureTargetsFromValues } from './sheet';

const values = [
  ['업체명', '키워드', '노출여부', 'vpn', '아이디', '비번', '작업 카페'],
  [
    '업체A',
    '키워드A',
    '',
    '',
    '',
    '',
    'https://cafe.naver.com/firstcafe',
    '',
    'https://cafe.naver.com/secondcafe',
    '',
    '',
    '',
    '',
    '',
    '두 번째 카페',
  ],
  [
    '업체B',
    '키워드B',
    '',
    '',
    '',
    '',
    '',
    '',
    'https://cafe.naver.com/secondcafe',
    '',
    '',
    '',
    '',
    '',
    '중복 이름',
  ],
];

assert.deepEqual(buildCafeExposureTargetsFromValues(values), [
  { name: '두 번째 카페', ids: ['firstcafe'] },
  { name: '두 번째 카페', ids: ['secondcafe'] },
]);

process.stdout.write('cafe source sheet tests passed\n');
