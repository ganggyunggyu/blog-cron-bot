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
