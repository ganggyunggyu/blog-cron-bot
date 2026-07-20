import assert from 'node:assert/strict';
import {
  assertUsableNaverHtml,
  runTasksWithCancellation,
  TransientExposureCheckError,
  wrapTransientExposureError,
} from './transient-failure';
import { getCrawlResult } from './crawl-manager';
import { runGuestRetry } from './guest-retry';
import { createDetailedLogBuilder } from '../../logs';
import type { CrawlCaches, SharedCrawlContext } from './types';

const createCaches = (): CrawlCaches => ({
  crawlCache: new Map(),
  itemsCache: new Map(),
  matchQueueMap: new Map(),
  htmlStructureCache: new Map(),
  guestAddedLinksCache: new Map(),
  usedLinksCache: new Map(),
});

assert.doesNotThrow(() =>
  assertUsableNaverHtml(
    '<html><main id="main_pack">검색 결과가 없습니다.</main></html>',
    '정상 미노출',
    'crawl'
  )
);

assert.throws(
  () =>
    assertUsableNaverHtml(
      '<html>검색 서비스 이용이 제한되었습니다</html>',
      '차단 키워드',
      'crawl'
    ),
  (error: unknown) =>
    error instanceof TransientExposureCheckError &&
    error.stage === 'crawl' &&
    error.searchQuery === '차단 키워드'
);

const httpError = Object.assign(new Error('HTTP 403'), { status: 403 });
const wrapped = wrapTransientExposureError(httpError, {
  stage: 'guest-retry',
  searchQuery: '재시도 키워드',
});
assert.equal(wrapped.status, 403);
assert.equal(wrapped.stage, 'guest-retry');
assert.equal(wrapped.cause, httpError);

const run = async (): Promise<void> => {
  const started: number[] = [];
  const completed: number[] = [];

  await assert.rejects(
    runTasksWithCancellation(
      [1, 2, 3, 4],
      2,
      async (task) => {
        started.push(task);

        if (task === 2) {
          throw new TransientExposureCheckError({
            stage: 'crawl',
            searchQuery: '실패',
            message: 'HTTP 403',
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 15));
        completed.push(task);
      }
    ),
    (error: unknown) =>
      error instanceof TransientExposureCheckError &&
      error.searchQuery === '실패'
  );

  assert.deepEqual(started, [1, 2]);
  assert.deepEqual(completed, [1]);

  let updateCount = 0;
  const rejectingCoordinator = {
    getCrawlSnapshot: async () => {
      throw Object.assign(new Error('HTTP 403'), { status: 403 });
    },
    getGuestHtml: async () => {
      throw Object.assign(new Error('HTTP 403'), { status: 403 });
    },
  } as unknown as SharedCrawlContext['coordinator'];

  await assert.rejects(
    getCrawlResult(
      '실패 키워드',
      { _id: 'keyword-id', keyword: '실패 키워드' },
      '실패 키워드',
      1,
      1,
      Date.now(),
      'basic',
      createCaches(),
      createDetailedLogBuilder(),
      async () => {
        updateCount += 1;
      },
      1,
      [],
      false,
      false,
      {
        coordinator: rejectingCoordinator,
        plans: new Map([
          [
            '실패 키워드',
            { maxPages: 1, requirements: [{ maxPages: 1, blogIds: [] }] },
          ],
        ]),
      }
    ),
    (error: unknown) =>
      error instanceof TransientExposureCheckError && error.status === 403
  );
  assert.equal(updateCount, 0);

  await assert.rejects(
    runGuestRetry({
      searchQuery: '게스트 실패',
      query: '게스트 실패',
      keywordDoc: { _id: 'guest-id', keyword: '게스트 실패' },
      topicNamesArray: [],
      matchQueue: [],
      blogIds: [],
      vendorTarget: '',
      restaurantName: '',
      caches: createCaches(),
      baseMatchesCount: 0,
      existingLinks: new Set(),
      sharedCrawlCoordinator: rejectingCoordinator,
    }),
    (error: unknown) =>
      error instanceof TransientExposureCheckError &&
      error.stage === 'guest-retry' &&
      error.status === 403
  );

  const previousFastMode = process.env.FAST_EXPOSURE_MODE;
  process.env.FAST_EXPOSURE_MODE = 'true';
  try {
    const fastModeResult = await runGuestRetry({
      searchQuery: '빠른 게스트 실패',
      query: '빠른 게스트 실패',
      keywordDoc: { _id: 'fast-guest-id', keyword: '빠른 게스트 실패' },
      topicNamesArray: [],
      matchQueue: [],
      blogIds: [],
      vendorTarget: '',
      restaurantName: '',
      caches: createCaches(),
      baseMatchesCount: 0,
      existingLinks: new Set(),
      sharedCrawlCoordinator: rejectingCoordinator,
    });
    assert.equal(fastModeResult.attempted, false);
    assert.equal(fastModeResult.recovered, false);
  } finally {
    if (previousFastMode === undefined) {
      delete process.env.FAST_EXPOSURE_MODE;
    } else {
      process.env.FAST_EXPOSURE_MODE = previousFastMode;
    }
  }
};

run()
  .then(() => {
    process.stdout.write('transient failure guard tests passed\n');
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  });
