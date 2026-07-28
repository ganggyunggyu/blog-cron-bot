import assert from 'node:assert/strict';
import { createDetailedLogBuilder } from '../../logs';
import type { OrderedExposureResult } from './types';
import { handleSuccess } from './handlers';

const allResults: OrderedExposureResult[] = [];

void handleSuccess({
  keyword: {
    keywordDoc: {
      _id: 'root-2',
      keyword: '공유 키워드(둘째업체)',
      company: '둘째업체',
    },
    query: '공유 키워드(둘째업체)',
    searchQuery: '공유 키워드',
    restaurantName: '',
    vendorTarget: '',
    keywordType: 'basic',
  },
  html: {
    items: [],
    isPopular: true,
    uniqueGroupsSize: 1,
    topicNamesArray: ['맛집 인기글'],
  },
  match: {
    nextMatch: {
      query: '공유 키워드(첫업체)',
      blogId: 'shared-blog',
      blogName: '공유 블로그',
      postTitle: '공유 글',
      postLink: 'https://blog.naver.com/shared-blog/1',
      exposureType: '인기글',
      topicName: '맛집 인기글',
      position: 1,
    },
    extractedVendor: '',
    matchSource: '',
    allMatchesCount: 1,
    remainingQueueCount: 1,
  },
  processing: {
    globalIndex: 2,
    totalKeywords: 2,
    keywordStartTime: Date.now(),
    logBuilder: createDetailedLogBuilder(),
  },
  allResults,
  updateFunction: async () => undefined,
}).then(() => {
  assert.equal(allResults.length, 1);
  assert.equal(allResults[0].result.query, '공유 키워드(둘째업체)');
  assert.equal(allResults[0].result.company, '둘째업체');
  process.stdout.write('keyword handler ownership tests passed\n');
});
