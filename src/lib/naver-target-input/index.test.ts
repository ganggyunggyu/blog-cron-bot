import assert from 'node:assert/strict';
import cases from './cases.json';
import { parseNaverTargetInputs } from './index';

// 대시보드도 같은 목록으로 검사한다. 한쪽만 고치면 여기서 깨진다.
cases.cases.forEach(({ line, cafeIds, blogIds, why }) => {
  const result = parseNaverTargetInputs([line]);
  assert.deepEqual(result.cafeIds, cafeIds, `카페(${why}): ${line}`);
  assert.deepEqual(result.blogIds, blogIds, `블로그(${why}): ${line}`);
});

// 카페 주소는 카페로.
{
  const r = parseNaverTargetInputs([
    'https://cafe.naver.com/localtable702/12345',
    'https://m.cafe.naver.com/menunote702',
  ]);
  assert.deepEqual(r.cafeIds, ['localtable702', 'menunote702']);
  assert.deepEqual(r.blogIds, []);
}

// 블로그 주소는 블로그로.
{
  const r = parseNaverTargetInputs([
    'https://blog.naver.com/higher_0/224367708238',
    'https://m.blog.naver.com/gee0403',
  ]);
  assert.deepEqual(r.blogIds, ['higher_0', 'gee0403']);
  assert.deepEqual(r.cafeIds, []);
}

// 섞어 넣어도 각자 자리로 간다.
{
  const r = parseNaverTargetInputs([
    'https://cafe.naver.com/localtable702',
    'https://blog.naver.com/higher_0',
  ]);
  assert.deepEqual(r.cafeIds, ['localtable702']);
  assert.deepEqual(r.blogIds, ['higher_0']);
}

// 아이디만 적으면 어느 쪽인지 모르니 둘 다 후보로 둔다. 아이디가 정확히 같을 때만
// 걸리므로 이렇게 둬도 엉뚱한 게 잡히지 않는다.
{
  const r = parseNaverTargetInputs(['localtable702']);
  assert.deepEqual(r.cafeIds, ['localtable702']);
  assert.deepEqual(r.blogIds, ['localtable702']);
}

// 대소문자와 공백은 정리한다.
{
  const r = parseNaverTargetInputs(['  https://cafe.naver.com/LocalTable702  ']);
  assert.deepEqual(r.cafeIds, ['localtable702']);
}

// 같은 걸 여러 번 넣어도 한 번만.
{
  const r = parseNaverTargetInputs([
    'https://cafe.naver.com/a/1',
    'https://cafe.naver.com/a/2',
  ]);
  assert.deepEqual(r.cafeIds, ['a']);
}

// 우리가 못 읽는 줄은 버리되 무엇을 버렸는지 남긴다.
{
  const r = parseNaverTargetInputs([
    'https://cafe.daum.net/x',
    'https://cafe.naver.com/f-e/cafes/1/articles/2',
    '한글 이름',
  ]);
  assert.deepEqual(r.cafeIds, []);
  assert.deepEqual(r.blogIds, []);
  assert.equal(r.ignored.length, 3, '버린 줄은 전부 알려줘야 함');
}

process.stdout.write('naver target input tests passed\n');
