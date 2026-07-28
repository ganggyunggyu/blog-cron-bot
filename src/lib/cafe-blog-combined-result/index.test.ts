import assert from 'node:assert/strict';
import { buildCombinedExposureResult } from './index';

const result = buildCombinedExposureResult(
  [{
    targetName: '가중건다',
    actualCafeName: '가중건다',
    sourceId: 'healthhhh',
    link: 'https://cafe.naver.com/healthhhh/1',
    matchedBy: 'id',
    cafeRank: 2,
  }],
  [{
    query: '키워드',
    blogId: 'blog1',
    blogName: '블로그A',
    postTitle: '제목',
    postLink: 'https://blog.naver.com/blog1/1',
    exposureType: '인기글',
    topicName: '맛집 인기글',
    position: 3,
  }]
);

assert.deepEqual(result, {
  exposureStatus: '노출',
  rank: '카페 2 | 블로그 3',
  name: '[카페] 가중건다 | [블로그] 블로그A',
  links:
    'https://cafe.naver.com/healthhhh/1 | https://blog.naver.com/blog1/1',
});
assert.equal(buildCombinedExposureResult([], []).exposureStatus, '미노출');

process.stdout.write('cafe blog combined result tests passed\n');
