import { crawlWithRetry } from '../../crawler';
import { logger } from '../logger';
import { crawlMultiPagesPlaywright } from '../playwright-crawler';

interface SinglePageLoaderDependencies {
  crawlHttp: (query: string, maxRetries: number) => Promise<string>;
  crawlBrowser: (query: string, maxPages: number) => Promise<string[]>;
}

const defaultDependencies: SinglePageLoaderDependencies = {
  crawlHttp: crawlWithRetry,
  crawlBrowser: crawlMultiPagesPlaywright,
};

const isForbidden = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  error.status === 403;

export const loadSinglePageHtml = async (
  searchQuery: string,
  maxRetries: number,
  dependencies: SinglePageLoaderDependencies = defaultDependencies
): Promise<string> => {
  try {
    return await dependencies.crawlHttp(searchQuery, maxRetries);
  } catch (error) {
    if (!isForbidden(error)) throw error;

    logger.warn(`HTTP 403 - "${searchQuery}" 브라우저 폴백 실행`);
    const [html] = await dependencies.crawlBrowser(searchQuery, 1);
    if (!html) throw error;
    return html;
  }
};
