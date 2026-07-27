import assert from 'node:assert/strict';
import { toFreshSuripetKeyword } from './suripet-page-check';

const keyword = toFreshSuripetKeyword({
  키워드: '김포강아지분양',
  인기주제: '반려동물 인기글',
  순위: '0',
  노출여부: 'o',
  링크: '',
  '바이럴 체크': 'o',
  로직: '신규',
});

assert.equal(keyword.keyword, '김포강아지분양');
assert.equal(keyword.visibility, false);
assert.equal(keyword.popularTopic, '');
assert.equal(keyword.url, '');
assert.equal(keyword.rank, 0);
assert.equal(keyword.matchedTitle, '');
assert.equal(keyword.foundPage, 0);
assert.equal(keyword.isUpdateRequired, true);
assert.equal(keyword.isNewLogic, true);

process.stdout.write('suripet page check import tests passed\n');
