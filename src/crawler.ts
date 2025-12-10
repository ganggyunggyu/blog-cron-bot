import { getRandomHeaders } from './constants';
import { getSearchQuery } from './utils';

type GotScrapingClient = typeof import('got-scraping').gotScraping;

let gotScrapingClient: GotScrapingClient | null = null;

const dynamicImport = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<any>;

const getGotScrapingClient = async (): Promise<GotScrapingClient> => {
  if (!gotScrapingClient) {
    const { gotScraping } = (await dynamicImport('got-scraping')) as {
      gotScraping: GotScrapingClient;
    };
    gotScrapingClient = gotScraping;
  }

  return gotScrapingClient;
};

export const buildNaverSearchUrl = (query: string): string => {
  const q = getSearchQuery(query);
  return `https://m.search.naver.com/search.naver?query=${encodeURIComponent(
    q
  )}`;
};

export const fetchHtml = async (
  url: string,
  headers: Record<string, string>
): Promise<string> => {
  const client = await getGotScrapingClient();
  const response = await client.get(url, {
    headers,
    http2: true,
    timeout: { request: 30000 },
    throwHttpErrors: false,
  });

  const status = response.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    const error = new Error(`HTTP ${status}`) as Error & {
      status: number;
    };
    error.status = status;
    throw error;
  }

  return response.body;
};

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const randomDelay = (min: number, max: number) =>
  delay(Math.floor(Math.random() * (max - min + 1)) + min);

export const crawlWithRetry = async (
  query: string,
  maxRetries: number = 3
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = buildNaverSearchUrl(query);
      const headers = getRandomHeaders();
      const html = await fetchHtml(url, headers);

      return html;
    } catch (error) {
      const err = error as Error & { status?: number };
      const is403 = err.status === 403;

      if (attempt < maxRetries) {
        const baseDelay = is403 ? 60000 : 30000;
        const backoff = baseDelay * attempt;
        const jitter = Math.floor(Math.random() * 1000);

        console.log(
          `⚠️ ${err.message} - ${attempt}/${maxRetries} 재시도 (${Math.round(
            (backoff + jitter) / 1000
          )}초 대기)`
        );

        await delay(backoff + jitter);
      } else {
        throw error;
      }
    }
  }

  throw new Error('크롤링 실패');
};
