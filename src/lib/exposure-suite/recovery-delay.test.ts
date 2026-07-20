import assert from 'node:assert/strict';
import { waitForRecoveryDelay } from './recovery-delay';

const run = async (): Promise<void> => {
  const controller = new AbortController();
  const startedAt = Date.now();
  const pendingDelay = waitForRecoveryDelay(5_000, controller.signal);

  controller.abort();
  await pendingDelay;

  assert.ok(Date.now() - startedAt < 1_000);
  await waitForRecoveryDelay(5_000, controller.signal);
};

run()
  .then(() => {
    process.stdout.write('exposure suite recovery delay tests passed\n');
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  });
