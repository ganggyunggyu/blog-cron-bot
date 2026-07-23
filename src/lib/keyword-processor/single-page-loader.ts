import { crawlWithRetry } from '../../crawler';
import { logger } from '../logger';
import { crawlMultiPagesPlaywright } from '../playwright-crawler';

interface SinglePageLoaderDependencies {
  crawlHttp: (query: string, maxRetries: number) => Promise<string>;
  crawlBrowser: (query: string, maxPages: number) => Promise<string[]>;
}

const DEFAULT_BROWSER_FALLBACK_CONCURRENCY = 16;
const browserFallbackQueue: Array<() => void> = [];
let activeBrowserFallbacks = 0;

const defaultDependencies: SinglePageLoaderDependencies = {
  crawlHttp: crawlWithRetry,
  crawlBrowser: crawlMultiPagesPlaywright,
};

const getBrowserFallbackConcurrency = (): number => {
  const configured = Number(
    process.env.EXPOSURE_BROWSER_FALLBACK_CONCURRENCY
  );
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_BROWSER_FALLBACK_CONCURRENCY;
};

const startNextBrowserFallback = (): void => {
  while (
    activeBrowserFallbacks < getBrowserFallbackConcurrency() &&
    browserFallbackQueue.length > 0
  ) {
    browserFallbackQueue.shift()?.();
  }
};

const withBrowserFallbackPermit = <T>(loader: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const run = (): void => {
      activeBrowserFallbacks += 1;
      void loader()
        .then(resolve, reject)
        .finally(() => {
          activeBrowserFallbacks -= 1;
          startNextBrowserFallback();
        });
    };
    browserFallbackQueue.push(run);
    startNextBrowserFallback();
  });

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
    const [html] = await withBrowserFallbackPermit(() =>
      dependencies.crawlBrowser(searchQuery, 1)
    );
    if (!html) throw error;
    return html;
  }
};
