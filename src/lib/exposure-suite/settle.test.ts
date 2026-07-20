import assert from 'node:assert/strict';
import { waitForAllOrThrow } from './settle';

const run = async (): Promise<void> => {
  let slowTaskFinished = false;
  const slowTask = new Promise<string>((resolve) => {
    setTimeout(() => {
      slowTaskFinished = true;
      resolve('finished');
    }, 20);
  });

  await assert.rejects(
    waitForAllOrThrow([
      Promise.reject(new Error('first target failed')),
      slowTask,
    ]),
    /first target failed/
  );
  assert.equal(slowTaskFinished, true);

  assert.deepEqual(
    await waitForAllOrThrow([
      Promise.resolve('first'),
      Promise.resolve('second'),
    ]),
    ['first', 'second']
  );
};

run()
  .then(() => {
    process.stdout.write('exposure suite settle tests passed\n');
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  });
