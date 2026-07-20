import assert from 'node:assert/strict';
import { Browser, BrowserContext, Route, chromium } from 'playwright';
import {
  closeBrowser,
  launchBrowser,
  shouldBlockBrowserResource,
} from './browser';

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
  let registeredRoutePattern = '';
  let registeredRouteHandler: ((route: Route) => Promise<void>) | undefined;

  const fakeContext = {
    addCookies: async () => {},
    route: async (
      pattern: string,
      handler: (route: Route) => Promise<void>
    ) => {
      registeredRoutePattern = pattern;
      registeredRouteHandler = handler;
    },
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
    assert.equal(registeredRoutePattern, '**/*');
    assert.ok(registeredRouteHandler);
    assert.equal(shouldBlockBrowserResource('image'), true);
    assert.equal(shouldBlockBrowserResource('font'), true);
    assert.equal(shouldBlockBrowserResource('media'), true);
    assert.equal(shouldBlockBrowserResource('document'), false);
    assert.equal(shouldBlockBrowserResource('xhr'), false);
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
