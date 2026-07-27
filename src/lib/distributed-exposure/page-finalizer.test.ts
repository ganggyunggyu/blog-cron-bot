import assert from 'node:assert/strict';
import { assertCompletePageExposureResults } from './page-finalizer';

assert.doesNotThrow(() =>
  assertCompletePageExposureResults('suripet', [
    {
      keyword: '노출 키워드',
      visibility: true,
      url: 'https://blog.naver.com/example/1',
      rank: 2,
    },
    {
      keyword: '미노출 키워드',
      visibility: false,
      url: '',
      rank: 0,
    },
  ])
);

assert.throws(
  () =>
    assertCompletePageExposureResults('suripet', [
      {
        keyword: '링크 누락',
        visibility: true,
        url: '',
        rank: 1,
      },
    ]),
  /노출 결과 필수값 누락/
);

assert.throws(
  () =>
    assertCompletePageExposureResults('suripet', [
      {
        keyword: '순위 누락',
        visibility: true,
        url: 'https://blog.naver.com/example/2',
        rank: 0,
      },
    ]),
  /노출 결과 필수값 누락/
);

process.stdout.write('distributed page finalizer tests passed\n');
