import assert from 'node:assert/strict';
import {
  REQUEST_BROKER_TOKEN_ENV,
  REQUEST_BROKER_URL_ENV,
  startRequestBroker,
} from './request-broker';
import {
  acquireRequestPermit,
  withRequestPermit,
} from './request-broker-client';

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await delay(5);
  }
  throw new Error('조건 대기시간 초과');
};

const testStandaloneBypass = async (): Promise<void> => {
  let called = false;
  const result = await withRequestPermit(
    async () => {
      called = true;
      return 'standalone';
    },
    {}
  );

  assert.equal(called, true);
  assert.equal(result, 'standalone');
};

const testGlobalLimitAndErrorRelease = async (): Promise<void> => {
  const broker = await startRequestBroker(2);
  let active = 0;
  let maximumActive = 0;

  try {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        withRequestPermit(
          async () => {
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            try {
              await delay(10 + (index % 3));
            } finally {
              active -= 1;
            }
          },
          broker.environment,
          { acquireTimeoutMs: 2_000 }
        )
      )
    );

    assert.equal(maximumActive, 2);
    await waitFor(() => broker.getSnapshot().active === 0);

    await assert.rejects(
      withRequestPermit(
        async () => {
          throw new Error('operation failed');
        },
        broker.environment
      ),
      /operation failed/
    );

    await withRequestPermit(async () => 'released', broker.environment);
    await waitFor(() => broker.getSnapshot().active === 0);
  } finally {
    await broker.close();
  }
};

const testTimedOutWaiterDoesNotConsumePermit = async (): Promise<void> => {
  const broker = await startRequestBroker(1);

  try {
    const firstPermit = await acquireRequestPermit(broker.environment, {
      acquireTimeoutMs: 1_000,
    });
    assert.ok(firstPermit);

    await assert.rejects(
      acquireRequestPermit(broker.environment, { acquireTimeoutMs: 25 }),
      /대기시간 초과/
    );
    await waitFor(() => broker.getSnapshot().queued === 0);
    assert.equal(broker.getSnapshot().active, 1);

    await firstPermit.release();
    await withRequestPermit(async () => 'next', broker.environment, {
      acquireTimeoutMs: 1_000,
    });
  } finally {
    await broker.close();
  }
};

const testConfiguredBrokerFailsClosed = async (): Promise<void> => {
  await assert.rejects(
    acquireRequestPermit({
      [REQUEST_BROKER_URL_ENV]: 'http://127.0.0.1:1',
    }),
    /설정이 불완전함/
  );

  await assert.rejects(
    acquireRequestPermit({
      [REQUEST_BROKER_URL_ENV]: 'https://example.com',
      [REQUEST_BROKER_TOKEN_ENV]: 'not-a-real-token',
    }),
    /로컬 HTTP 주소만 허용됨/
  );

  const broker = await startRequestBroker(1);
  await assert.rejects(
    acquireRequestPermit(
      {
        ...broker.environment,
        [REQUEST_BROKER_TOKEN_ENV]: 'invalid-token',
      },
      { acquireTimeoutMs: 500 }
    ),
    /HTTP 401/
  );
  const staleEnvironment = { ...broker.environment };
  await broker.close();

  await assert.rejects(
    acquireRequestPermit(staleEnvironment, { acquireTimeoutMs: 500 }),
    /연결 실패/
  );
};

const testCleanShutdownRejectsWaiters = async (): Promise<void> => {
  const broker = await startRequestBroker(1);
  const activePermit = await acquireRequestPermit(broker.environment);
  assert.ok(activePermit);

  const queuedPermit = acquireRequestPermit(broker.environment, {
    acquireTimeoutMs: 1_000,
  });
  await waitFor(() => broker.getSnapshot().queued === 1);

  await broker.close();
  await assert.rejects(queuedPermit, /연결 실패|조기 종료/);
  await activePermit.release();
};

const main = async (): Promise<void> => {
  await testStandaloneBypass();
  await testGlobalLimitAndErrorRelease();
  await testTimedOutWaiterDoesNotConsumePermit();
  await testConfiguredBrokerFailsClosed();
  await testCleanShutdownRejectsWaiters();
  process.stdout.write('request broker tests passed\n');
};

void main();
