import assert from 'node:assert/strict';
import type { ExposureResult } from '../matcher';
import { summarizeExposureRows } from './exposure-summary';

const result = (query: string, company?: string): ExposureResult => ({
  query,
  company,
  blogId: 'test-blog',
  blogName: 'test',
  postTitle: 'test',
  postLink: 'https://blog.naver.com/test-blog/1',
  exposureType: '인기글',
  topicName: '인기글',
  position: 1,
});

const summary = summarizeExposureRows(
  [
    { keyword: '같은 키워드', company: '업체 A' },
    { keyword: '같은 키워드', company: '업체 B' },
    { keyword: '반복 키워드', company: '업체 C' },
    { keyword: '반복 키워드', company: '업체 C' },
    { keyword: '보류 키워드', company: '업체 D', isUpdateRequired: true },
  ],
  [result('같은 키워드', '업체 A'), result('반복 키워드', '업체 C')]
);

assert.equal(summary.exposedCount, 2);
assert.deepEqual(summary.missingKeywords, ['같은 키워드', '반복 키워드']);

process.stdout.write('exposure summary tests passed\n');
