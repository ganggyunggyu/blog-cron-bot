import { chromium, Browser, BrowserContext } from 'playwright';
import { buildNaverCookie } from '../../crawler';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

export const launchBrowser = async (): Promise<BrowserContext> => {
  if (context) return context;

  browser = await chromium.launch({
    headless: false,
  });

  const cookie = buildNaverCookie();
  const cookies = cookie
    ? cookie.split('; ').map((c) => {
        const [name, value] = c.split('=');
        return { name, value, domain: '.naver.com', path: '/' };
      })
    : [];

  context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
  });

  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }

  return context;
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
};
