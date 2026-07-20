import assert from 'node:assert/strict';
import { Browser, BrowserContext, chromium } from 'playwright';
import { closeBrowser, launchBrowser } from './browser';

const main = async (): Promise<void> => {
  const originalLaunchDescriptor = Object.getOwnPropertyDescriptor(
    chromium,
    'launch'
  );
  let releaseLaunch: (() => void) | undefined;
  const launchGate = new Promise<void>((resolve) => {
    releaseLaunch = resolve;
  });
  let launchCount = 0;
  let contextCount = 0;

  const fakeContext = {
    addCookies: async () => {},
    close: async () => {},
  } as unknown as BrowserContext;
  const fakeBrowser = {
    newContext: async () => {
      contextCount += 1;
      return fakeContext;
    },
    close: async () => {},
  } as unknown as Browser;

  Object.defineProperty(chromium, 'launch', {
    configurable: true,
    value: async () => {
      launchCount += 1;
      await launchGate;
      return fakeBrowser;
    },
  });

  const firstLaunch = launchBrowser();
  const secondLaunch = launchBrowser();

  try {
    assert.equal(launchCount, 1);
    releaseLaunch?.();

    const [firstContext, secondContext] = await Promise.all([
      firstLaunch,
      secondLaunch,
    ]);
    assert.equal(firstContext, fakeContext);
    assert.equal(secondContext, fakeContext);
    assert.equal(contextCount, 1);
  } finally {
    releaseLaunch?.();
    await Promise.allSettled([firstLaunch, secondLaunch]);
    await closeBrowser();

    if (originalLaunchDescriptor) {
      Object.defineProperty(chromium, 'launch', originalLaunchDescriptor);
    } else {
      Reflect.deleteProperty(chromium, 'launch');
    }
  }

  process.stdout.write('browser launch tests passed\n');
};

void main();
