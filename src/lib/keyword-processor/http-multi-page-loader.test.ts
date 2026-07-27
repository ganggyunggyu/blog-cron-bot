import assert from 'node:assert/strict';
import { loadHttpMultiPages } from './http-multi-page-loader';

const run = async (): Promise<void> => {
  const fetchedPages: number[] = [];
  const seenPages: number[] = [];
  let retryWaits = 0;

  const crawledPages = await loadHttpMultiPages(
    '애견',
    4,
    2,
    (_html, page) => {
      seenPages.push(page);
      return page === 3;
    },
    {
      fetchPage: async (_query, page) => {
        fetchedPages.push(page);
        const pageAttempts = fetchedPages.filter((value) => value === page);
        if (page === 2 && pageAttempts.length === 1) {
          throw Object.assign(new Error('HTTP 403'), { status: 403 });
        }
        return `<html>page ${page}</html>`;
      },
      waitBeforeRetry: async (_attempt, is403) => {
        assert.equal(is403, true);
        retryWaits += 1;
      },
      waitBetweenPages: async () => undefined,
    }
  );

  assert.equal(crawledPages, 3);
  assert.deepEqual(fetchedPages, [1, 2, 2, 3]);
  assert.deepEqual(seenPages, [1, 2, 3]);
  assert.equal(retryWaits, 1);
};

run()
  .then(() => process.stdout.write('HTTP multi-page loader tests passed\n'))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  });
