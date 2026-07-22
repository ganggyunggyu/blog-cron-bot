import assert from 'node:assert/strict';
import { buildPetResultRows } from './pet-page-check';

const rows = buildPetResultRows(
  ['첫 키워드', '중복 키워드', '중복 키워드', '마지막 키워드'],
  [
    {
      keyword: '중복 키워드',
      visibility: true,
      popularTopic: '첫 결과',
      url: 'https://blog.naver.com/example/1',
      rank: 1,
      rankWithCafe: 2,
      isNewLogic: true,
    },
    {
      keyword: '마지막 키워드',
      visibility: false,
      popularTopic: '',
      url: '',
    },
    {
      keyword: '첫 키워드',
      visibility: true,
      popularTopic: '원본 첫 행',
      url: 'https://blog.naver.com/example/first',
      rank: 3,
    },
    {
      keyword: '중복 키워드',
      visibility: true,
      popularTopic: '둘째 결과',
      url: 'https://blog.naver.com/example/2',
      rank: 4,
    },
  ]
);

assert.deepEqual(
  rows.map((row) => row[0]),
  ['첫 키워드', '중복 키워드', '중복 키워드', '마지막 키워드']
);
assert.equal(rows[1][1], '첫 결과');
assert.equal(rows[2][1], '둘째 결과');
assert.deepEqual(rows[3], ['마지막 키워드', '', '', '', '', '', '']);

assert.throws(
  () => buildPetResultRows(['없는 키워드'], []),
  /원본과 결과 키워드 수가 다름/
);

process.stdout.write('pet page check order tests passed\n');
