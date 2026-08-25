import assert from 'node:assert/strict';
import cases from './cases.json';
import { extractCafeRefFromLink, parseNaverCafeUrl } from './index';

cases.accepted.forEach(({ url, cafeId, articleId, why }) => {
  const result = parseNaverCafeUrl(url);
  assert.equal(result.ok, true, `받아야 함(${why}): ${url}`);
  if (!result.ok) return;
  assert.equal(result.cafeId, cafeId, `카페 아이디(${why}): ${url}`);
  assert.equal(result.articleId, articleId, `글 번호(${why}): ${url}`);
});

cases.rejected.forEach(({ url, reason, why }) => {
  const result = parseNaverCafeUrl(url);
  assert.equal(result.ok, false, `거절해야 함(${why}): ${url}`);
  if (result.ok) return;
  assert.equal(result.reason, reason, `거절 사유(${why}): ${url}`);
});

// 검색 결과 링크도 같은 파서를 탄다. 붙여넣은 주소와 검색 결과를 서로 다른 규칙으로
// 읽으면 같은 글인데도 다른 글로 판정된다.
assert.deepEqual(
  extractCafeRefFromLink('https://cafe.naver.com/localtable702/12345?art=x'),
  { cafeId: 'localtable702', articleId: '12345' }
);
assert.equal(extractCafeRefFromLink('https://blog.naver.com/a/1'), null);
assert.equal(extractCafeRefFromLink(''), null);
assert.equal(extractCafeRefFromLink(undefined), null);

process.stdout.write('naver cafe url tests passed\n');
