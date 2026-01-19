import { Page } from 'playwright';
import { launchBrowser, launchBrowserInstance } from './browser';
import { getSearchQuery } from '../../utils';
import { logger } from '../logger';
import {
  TIMEOUT,
  DELAY,
  PAGINATION,
  SELECTORS,
  BLOCKED_INDICATORS,
  buildNaverSearchUrl,
  buildViewTabUrl,
  getContentLoadDelay,
  getPageNavigationDelay,
  getViewTabDelay,
} from '../../constants/crawl-config';

const buildSearchUrl = (query: string, page: number): string =>
  buildNaverSearchUrl(getSearchQuery(query), page);

const buildViewTabSearchUrl = (query: string, page: number): string =>
  buildViewTabUrl(getSearchQuery(query), page);

const waitForContent = async (page: Page): Promise<void> => {
  await page
    .waitForSelector(SELECTORS.MAIN_PACK, { timeout: TIMEOUT.SELECTOR_WAIT })
    .catch(() => {});
  await page.waitForTimeout(getContentLoadDelay());
};

const checkBlocked = async (page: Page): Promise<boolean> => {
  const content = await page.content();
  return BLOCKED_INDICATORS.some((indicator) => content.includes(indicator));
};

const handleBlocked = async (page: Page): Promise<void> => {
  logger.warn('⚠️ 차단 감지! 5초 대기 후 재시도...');

  const releaseButton = page.locator(SELECTORS.RELEASE_BUTTON);
  if ((await releaseButton.count()) > 0) {
    await releaseButton.click();
    await page.waitForTimeout(DELAY.BUTTON_CLICK);
    logger.info('제한 해제 버튼 클릭 완료');
  }

  await page.waitForTimeout(DELAY.BLOCKED_WAIT);
  logger.info('5초 대기 완료, 페이지 새로고침...');
  await page.reload();
  await waitForContent(page);
};

const getPageButtonSelector = (pageNum: number): string =>
  `${SELECTORS.PAGE_BUTTON_CONTAINER}:has-text("${pageNum}")`;

export const crawlMultiPagesPlaywright = async (
  query: string,
  maxPages: number = PAGINATION.DEFAULT_MAX_PAGES,
  onPageCrawled?: (html: string, pageNum: number) => boolean
): Promise<string[]> => {
  const context = await launchBrowser();
  const page = await context.newPage();
  const htmls: string[] = [];

  try {
    const firstUrl = buildSearchUrl(query, 1);
    logger.info(`1페이지 URL: ${firstUrl}`);
    await page.goto(firstUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await waitForContent(page);

    if (await checkBlocked(page)) {
      await handleBlocked(page);
    }

    const firstHtml = await page.content();
    htmls.push(firstHtml);
    logger.info(`📄 페이지 1/${maxPages} 크롤링 완료`);

    if (onPageCrawled && onPageCrawled(firstHtml, 1)) {
      logger.info(`✅ 1페이지에서 매칭 발견, 크롤링 종료`);
      return htmls;
    }

    for (let pageNum = 2; pageNum <= maxPages; pageNum++) {
      await page.waitForTimeout(getPageNavigationDelay());

      const pageButton = page.locator(getPageButtonSelector(pageNum));
      const buttonExists = (await pageButton.count()) > 0;

      if (!buttonExists) {
        logger.info(`페이지 ${pageNum} 버튼 없음, 크롤링 종료`);
        break;
      }

      await pageButton.click();
      await page.waitForLoadState('domcontentloaded');
      await waitForContent(page);

      if (await checkBlocked(page)) {
        await handleBlocked(page);
      }

      const pageHtml = await page.content();
      htmls.push(pageHtml);
      logger.info(`📄 페이지 ${pageNum}/${maxPages} 크롤링 완료 (버튼 클릭)`);

      if (onPageCrawled && onPageCrawled(pageHtml, pageNum)) {
        logger.info(`✅ ${pageNum}페이지에서 매칭 발견, 크롤링 종료`);
        break;
      }
    }
  } finally {
    await page.close();
  }

  return htmls;
};

export const crawlMultiPagesWithInstance = async (
  instanceId: string,
  query: string,
  maxPages: number = PAGINATION.DEFAULT_MAX_PAGES,
  onPageCrawled?: (html: string, pageNum: number) => boolean
): Promise<string[]> => {
  const context = await launchBrowserInstance(instanceId);
  const page = await context.newPage();
  const htmls: string[] = [];

  try {
    const firstUrl = buildSearchUrl(query, 1);
    await page.goto(firstUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await waitForContent(page);

    if (await checkBlocked(page)) {
      await handleBlocked(page);
    }

    const firstHtml = await page.content();
    htmls.push(firstHtml);

    if (onPageCrawled && onPageCrawled(firstHtml, 1)) {
      return htmls;
    }

    for (let pageNum = 2; pageNum <= maxPages; pageNum++) {
      await page.waitForTimeout(getPageNavigationDelay());

      const pageButton = page.locator(getPageButtonSelector(pageNum));
      const buttonExists = (await pageButton.count()) > 0;

      if (!buttonExists) {
        break;
      }

      await pageButton.click();
      await page.waitForLoadState('domcontentloaded');
      await waitForContent(page);

      if (await checkBlocked(page)) {
        await handleBlocked(page);
      }

      const pageHtml = await page.content();
      htmls.push(pageHtml);

      if (onPageCrawled && onPageCrawled(pageHtml, pageNum)) {
        break;
      }
    }
  } finally {
    await page.close();
  }

  return htmls;
};

export const crawlSinglePagePlaywright = async (
  query: string
): Promise<string> => {
  const htmls = await crawlMultiPagesPlaywright(query, 1);
  return htmls[0];
};

export const crawlViewTabPlaywright = async (
  query: string,
  maxPages: number = PAGINATION.DEFAULT_MAX_PAGES
): Promise<string[]> => {
  const context = await launchBrowser();
  const page = await context.newPage();
  const htmls: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = buildViewTabSearchUrl(query, pageNum);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT.PAGE_LOAD,
      });
      await waitForContent(page);

      const html = await page.content();
      htmls.push(html);

      logger.info(`📄 VIEW 탭 페이지 ${pageNum}/${maxPages} 크롤링 완료`);

      if (pageNum < maxPages) {
        await page.waitForTimeout(getViewTabDelay());
      }
    }
  } finally {
    await page.close();
  }

  return htmls;
};
