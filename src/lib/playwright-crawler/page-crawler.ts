import { Page } from 'playwright';
import { launchBrowser } from './browser';
import { getSearchQuery } from '../../utils';
import { logger } from '../logger';

const buildSearchUrl = (query: string, page: number): string => {
  const q = getSearchQuery(query);
  if (page <= 1) {
    return `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(q)}`;
  }
  return `https://search.naver.com/search.naver?nso=&page=${page}&query=${encodeURIComponent(q)}&sm=tab_pge&ssc=tab.ur.all&start=1`;
};

const buildViewTabUrl = (query: string, page: number): string => {
  const q = getSearchQuery(query);
  const start = (page - 1) * 30 + 1;
  return `https://search.naver.com/search.naver?ssc=tab.blog.all&where=blog&query=${encodeURIComponent(q)}&start=${start}`;
};

const waitForContent = async (page: Page): Promise<void> => {
  await page.waitForSelector('#main_pack', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
};

export const crawlMultiPagesPlaywright = async (
  query: string,
  maxPages: number = 9
): Promise<string[]> => {
  const context = await launchBrowser();
  const page = await context.newPage();
  const htmls: string[] = [];

  try {
    const firstUrl = buildSearchUrl(query, 1);
    logger.info(`1페이지 URL: ${firstUrl}`);
    await page.goto(firstUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForContent(page);

    htmls.push(await page.content());
    logger.info(`📄 페이지 1/${maxPages} 크롤링 완료`);

    for (let pageNum = 2; pageNum <= maxPages; pageNum++) {
      await page.waitForTimeout(300 + Math.random() * 500);

      const pageButton = page.locator(`.sc_page_inner a.btn:has-text("${pageNum}")`);
      const buttonExists = await pageButton.count() > 0;

      if (!buttonExists) {
        logger.info(`페이지 ${pageNum} 버튼 없음, 크롤링 종료`);
        break;
      }

      await pageButton.click();
      await page.waitForLoadState('domcontentloaded');
      await waitForContent(page);

      htmls.push(await page.content());
      logger.info(`📄 페이지 ${pageNum}/${maxPages} 크롤링 완료 (버튼 클릭)`);
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
  maxPages: number = 9
): Promise<string[]> => {
  const context = await launchBrowser();
  const page = await context.newPage();
  const htmls: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = buildViewTabUrl(query, pageNum);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForContent(page);

      const html = await page.content();
      htmls.push(html);

      logger.info(`📄 VIEW 탭 페이지 ${pageNum}/${maxPages} 크롤링 완료`);

      if (pageNum < maxPages) {
        await page.waitForTimeout(300 + Math.random() * 500);
      }
    }
  } finally {
    await page.close();
  }

  return htmls;
};
