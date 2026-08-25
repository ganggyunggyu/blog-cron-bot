import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { InvalidJobInputError } from './job-errors';
import { buildRootCafeUrlArgs, parseNaverCafeUrl } from './root-cafe-url-options';

/**
 * 봇(src/lib/naver-cafe-url)과 같은 목록을 읽는다. 한쪽만 고치면 여기서 깨진다 —
 * 화면은 막았는데 CLI는 통과시키는(또는 그 반대) 상태로 배포되는 걸 막으려는 것이다.
 */
const CASES_PATH = path.join(
  __dirname,
  '../../../src/lib/naver-cafe-url/cases.json',
);
const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf-8')) as {
  accepted: { url: string; cafeId: string; articleId: string; why: string }[];
  rejected: { url: string; reason: string; why: string }[];
};

test('봇과 같은 주소를 받아들임', () => {
  assert.ok(cases.accepted.length > 0, '기준 목록이 비어 있으면 안 됨');
  cases.accepted.forEach(({ url, cafeId, articleId, why }) => {
    const parsed = parseNaverCafeUrl(url);
    assert.equal(parsed.ok, true, `받아야 함(${why}): ${url}`);
    if (!parsed.ok) return;
    assert.equal(parsed.cafeId, cafeId, `카페 아이디(${why})`);
    assert.equal(parsed.articleId, articleId, `글 번호(${why})`);
    assert.deepEqual(buildRootCafeUrlArgs({ url }), [`--url=${url.trim()}`]);
  });
});

test('봇과 같은 주소를 거절함', () => {
  assert.ok(cases.rejected.length > 0, '기준 목록이 비어 있으면 안 됨');
  cases.rejected.forEach(({ url, reason, why }) => {
    const parsed = parseNaverCafeUrl(url);
    assert.equal(parsed.ok, false, `거절해야 함(${why}): ${url}`);
    if (parsed.ok) return;
    assert.equal(parsed.reason, reason, `거절 사유(${why}): ${url}`);
    assert.throws(
      () => buildRootCafeUrlArgs({ url }),
      InvalidJobInputError,
      `거절해야 함(${why}): ${url}`,
    );
  });
});

test('url 자체가 없는 입력을 거부함', () => {
  const invalidInputs: unknown[] = [
    undefined,
    {},
    { url: 123 },
    { command: 'arbitrary-command' },
  ];
  invalidInputs.forEach((input) => {
    assert.throws(() => buildRootCafeUrlArgs(input), InvalidJobInputError);
  });
});
