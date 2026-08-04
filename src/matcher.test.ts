import assert from 'node:assert/strict';
import { collectBlogIdCandidates, matchBlogs } from './matcher';
import type { PopularItem } from './parser';

const buildItem = (overrides: Partial<PopularItem>): PopularItem =>
  ({
    title: '포메라니안 성격과 수명',
    link: 'https://m.blog.naver.com/higher_0/224367708238',
    snippet: '',
    image: '',
    badge: '',
    group: '인기글',
    blogLink: '',
    blogName: '미마',
    postPublishedAt: '4시간 전',
    sourceType: 'blog',
    sourceId: 'mima',
    ...overrides,
  }) as PopularItem;

/**
 * 인플루언서로 등록된 블로그는 검색 결과의 sourceId에 블로그 아이디가 아니라
 * 인플루언서 핸들이 담긴다. 미마는 핸들이 mima, 블로그가 higher_0이라 sourceId만
 * 보면 등록한 계정과 영원히 만나지 않아 한 건도 잡히지 않았다.
 */
const influencerItem = buildItem({});

assert.deepEqual(collectBlogIdCandidates(influencerItem), ['mima', 'higher_0']);

const matched = matchBlogs('포메라니안', [influencerItem], {
  blogIds: ['higher_0'],
});
assert.equal(matched.length, 1);
assert.equal(matched[0].blogId, 'higher_0');
assert.equal(matched[0].position, 1);

// 핸들로 등록해 둔 경우에도 그대로 잡혀야 한다.
const byHandle = matchBlogs('포메라니안', [influencerItem], {
  blogIds: ['mima'],
});
assert.equal(byHandle.length, 1);
assert.equal(byHandle[0].blogId, 'mima');

// 등록하지 않은 블로그는 후보가 둘이어도 잡히면 안 된다.
assert.equal(
  matchBlogs('포메라니안', [influencerItem], { blogIds: ['inho5062'] }).length,
  0
);

// 핸들과 블로그 아이디가 같은 평범한 계정은 이전과 동일하게 동작한다.
const plainItem = buildItem({
  link: 'https://blog.naver.com/inho5062/224359422820',
  sourceId: 'inho5062',
  blogName: '여행 다니는 남자',
});
assert.deepEqual(collectBlogIdCandidates(plainItem), ['inho5062']);
assert.equal(
  matchBlogs('포메라니안', [plainItem], { blogIds: ['inho5062'] })[0].blogId,
  'inho5062'
);

// 인플루언서 콘텐츠(in.naver.com)는 글 주소에 블로그 아이디가 없어 핸들만 후보가 된다.
const influencerContent = buildItem({
  group: '인플루언서 콘텐츠',
  link: 'https://in.naver.com/mima/contents/internal/818088842322656',
  blogLink: 'https://in.naver.com/mima',
  sourceId: 'mima',
});
assert.deepEqual(collectBlogIdCandidates(influencerContent), ['mima']);
assert.equal(
  matchBlogs('포메라니안', [influencerContent], { blogIds: ['mima'] })[0]
    .exposureType,
  '인플루언서 콘텐츠'
);

process.stdout.write('matcher tests passed\n');
