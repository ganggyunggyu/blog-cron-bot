import assert from 'node:assert/strict';
import { parseRootKeywordRows } from './index';

const rows = parseRootKeywordRows([
  [],
  ['업체명', '키워드', '노출여부', '인기주제', '순위', '인기글 순위', '이미지 매칭', '시트 링크'],
  ['업체A', '첫 키워드', 'o', '인기글', '2', '4', 'o', 'https://example.com/a'],
  ['', '둘째 키워드', '', '', '', '', '', ''],
  ['지료 미전달 리스트', '', '', '', '', '', '', ''],
  ['업체B', '제외 키워드', '', '', '', '', '', ''],
]);

assert.deepEqual(rows, [
  {
    company: '업체A',
    keyword: '첫 키워드(업체A)',
    visibility: true,
    popularTopic: '인기글',
    url: 'https://example.com/a',
    rank: 2,
    rankWithCafe: 4,
    isUpdateRequired: true,
    keywordType: 'basic',
  },
  {
    company: '업체A',
    keyword: '둘째 키워드(업체A)',
    visibility: false,
    popularTopic: '',
    url: '',
    rank: undefined,
    rankWithCafe: undefined,
    isUpdateRequired: false,
    keywordType: 'basic',
  },
]);

assert.equal(
  parseRootKeywordRows([
    ['업체명', '키워드'],
    ['업체A', '중복방지(업체A)'],
  ])[0].keyword,
  '중복방지(업체A)'
);

process.stdout.write('root keyword sync tests passed\n');
