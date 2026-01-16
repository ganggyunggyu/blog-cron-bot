import { chromium, Browser, BrowserContext } from 'playwright';
import { buildNaverCookie } from '../../crawler';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

const browserInstances = new Map<string, Browser>();
const contextInstances = new Map<string, BrowserContext>();

const createContext = async (browser: Browser): Promise<BrowserContext> => {
  const cookie = buildNaverCookie();
  const cookies = cookie
    ? cookie.split('; ').map((c) => {
        const [name, value] = c.split('=');
        return { name, value, domain: '.naver.com', path: '/' };
      })
    : [];

  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
  });

  if (cookies.length > 0) {
    await ctx.addCookies(cookies);
  }

  return ctx;
};

export const launchBrowser = async (): Promise<BrowserContext> => {
  if (context) return context;

  browser = await chromium.launch({
    headless: true,
  });

  context = await createContext(browser);
  return context;
};

export const launchBrowserInstance = async (
  instanceId: string
): Promise<BrowserContext> => {
  if (contextInstances.has(instanceId)) {
    return contextInstances.get(instanceId)!;
  }

  const newBrowser = await chromium.launch({
    headless: true,
  });

  const newContext = await createContext(newBrowser);

  browserInstances.set(instanceId, newBrowser);
  contextInstances.set(instanceId, newContext);

  return newContext;
};

export const closeBrowserInstance = async (instanceId: string): Promise<void> => {
  const ctx = contextInstances.get(instanceId);
  const br = browserInstances.get(instanceId);

  if (ctx) {
    await ctx.close();
    contextInstances.delete(instanceId);
  }
  if (br) {
    await br.close();
    browserInstances.delete(instanceId);
  }
};

export const closeAllBrowserInstances = async (): Promise<void> => {
  const closePromises: Promise<void>[] = [];

  for (const instanceId of contextInstances.keys()) {
    closePromises.push(closeBrowserInstance(instanceId));
  }

  await Promise.all(closePromises);
};

export const closeBrowser = async (): Promise<void> => {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }

  await closeAllBrowserInstances();
};
