import {
  buildNaverSearchUrlWithPage,
  calculateRetryDelay,
  delay,
  fetchHtml,
  randomDelay,
} from '../../crawler';
import { DELAY } from '../../constants/crawl-config';
import { logger } from '../logger';

interface HttpMultiPageDependencies {
  fetchPage: (query: string, page: number) => Promise<string>;
  waitBeforeRetry: (attempt: number, is403: boolean) => Promise<void>;
  waitBetweenPages: () => Promise<void>;
}

const defaultDependencies: HttpMultiPageDependencies = {
  fetchPage: (query, page) =>
    fetchHtml(buildNaverSearchUrlWithPage(query, page)),
  waitBeforeRetry: (attempt, is403) =>
    delay(calculateRetryDelay(attempt, is403)),
  waitBetweenPages: () =>
    randomDelay(DELAY.MULTI_PAGE_MIN, DELAY.MULTI_PAGE_MAX),
};

export const loadHttpMultiPages = async (
  query: string,
  maxPages: number,
  maxRetries: number,
  onPage: (html: string, page: number) => boolean,
  dependencies: HttpMultiPageDependencies = defaultDependencies
): Promise<number> => {
  let crawledPages = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const html = await dependencies.fetchPage(query, page);
        crawledPages += 1;
        if (onPage(html, page)) return crawledPages;
        if (page < maxPages) await dependencies.waitBetweenPages();
        break;
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (attempt >= maxRetries) throw error;

        logger.warn(
          `[페이지${page}] ${(error as Error).message} - ` +
            `${attempt}/${maxRetries} 재시도`
        );
        await dependencies.waitBeforeRetry(attempt, status === 403);
      }
    }
  }

  return crawledPages;
};
