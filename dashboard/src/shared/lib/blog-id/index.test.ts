import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBlogId, parsePastedBlogIds } from './index';

test('블로그 주소에서 아이디만 뽑음', () => {
  assert.equal(normalizeBlogId('https://m.blog.naver.com/introsm?tab=1'), 'introsm');
  assert.equal(normalizeBlogId('  AirTrd '), 'airtrd');
  assert.equal(normalizeBlogId('@@bad id@@'), '');
});

test('시트를 통째로 붙여넣어도 주소 칸에서만 아이디를 뽑음', () => {
  const pasted = [
    'NO.\t블로그 아이디\t블로그 링크\tID\tPW\t카테고리',
    '1\t나비드주얼리\thttps://m.blog.naver.com/solantoro\tsolantoro\tppp940304p\t최블',
    '2\t기록장\thttps://m.blog.naver.com/airtrd?tab=1\tairtrd\ta09678#@@\t하루2건',
  ].join('\n');

  const { blogIds, mode } = parsePastedBlogIds(pasted);

  assert.equal(mode, 'url');
  assert.deepEqual(blogIds, ['solantoro', 'airtrd']);
});

test('PostList.naver 주소는 blogId 파라미터에서 읽음', () => {
  const { blogIds } = parsePastedBlogIds(
    '실눈캐\thttps://m.blog.naver.com/PostList.naver?blogId=ghostrush7&tab=1\tghostrush7\tdashrun1!',
  );

  assert.deepEqual(blogIds, ['ghostrush7']);
});

test('주소가 없으면 아이디 나열로 보고 그대로 읽음', () => {
  const { blogIds, mode } = parsePastedBlogIds('introsm, airtrd\ntpeany');

  assert.equal(mode, 'plain');
  assert.deepEqual(blogIds, ['introsm', 'airtrd', 'tpeany']);
});

test('같은 아이디가 여러 줄에 나와도 한 번만 남김', () => {
  const { blogIds } = parsePastedBlogIds(
    'https://blog.naver.com/sunyzone2\nhttps://m.blog.naver.com/sunyzone2?tab=1',
  );

  assert.deepEqual(blogIds, ['sunyzone2']);
});
