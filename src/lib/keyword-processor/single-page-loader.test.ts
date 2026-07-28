import assert from 'node:assert/strict';
import { loadSinglePageHtml } from './single-page-loader';

const run = async (): Promise<void> => {
  let browserCalls = 0;
  const fallbackHtml = await loadSinglePageHtml('차단 키워드', 2, {
    crawlHttp: async () => {
      throw Object.assign(new Error('HTTP 403'), { status: 403 });
    },
    crawlBrowser: async () => {
      browserCalls += 1;
      return ['browser html'];
    },
  });

  assert.equal(fallbackHtml, 'browser html');
  assert.equal(browserCalls, 1);

  const previousConcurrency =
    process.env.EXPOSURE_BROWSER_FALLBACK_CONCURRENCY;
  process.env.EXPOSURE_BROWSER_FALLBACK_CONCURRENCY = '2';
  let activeFallbacks = 0;
  let maxActiveFallbacks = 0;

  await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      loadSinglePageHtml(`동시성-${index}`, 1, {
        crawlHttp: async () => {
          throw Object.assign(new Error('HTTP 403'), { status: 403 });
        },
        crawlBrowser: async () => {
          activeFallbacks += 1;
          maxActiveFallbacks = Math.max(
            maxActiveFallbacks,
            activeFallbacks
          );
          await new Promise((resolve) => setTimeout(resolve, 5));
          activeFallbacks -= 1;
          return ['browser html'];
        },
      })
    )
  );

  assert.equal(maxActiveFallbacks, 2);
  if (previousConcurrency === undefined) {
    delete process.env.EXPOSURE_BROWSER_FALLBACK_CONCURRENCY;
  } else {
    process.env.EXPOSURE_BROWSER_FALLBACK_CONCURRENCY =
      previousConcurrency;
  }

  await assert.rejects(
    loadSinglePageHtml('서버 오류', 2, {
      crawlHttp: async () => {
        throw Object.assign(new Error('HTTP 500'), { status: 500 });
      },
      crawlBrowser: async () => ['unused'],
    }),
    /HTTP 500/
  );
};

run()
  .then(() => process.stdout.write('single page loader tests passed\n'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
