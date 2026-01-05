import { getSearchQuery } from './utils';
import 'dotenv/config';
import { logger } from './lib/logger';

type GotScrapingClient = typeof import('got-scraping').gotScraping;

export const buildNaverCookie = (): string | undefined => {
  const nidAut = process.env.NAVER_NID_AUT;
  const nidSes = process.env.NAVER_NID_SES;
  const mLoc = process.env.NAVER_M_LOC;

  if (nidAut && nidSes) {
    let cookie = `NID_AUT=${nidAut}; NID_SES=${nidSes}`;
    if (mLoc) {
      cookie += `; m_loc=${mLoc}`;
    }
    return cookie;
  }
  return undefined;
};

const generateAckey = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
};

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
  return `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(
    q
  )}&ackey=${generateAckey()}`;
};

export const buildNaverSearchUrlWithPage = (query: string, page: number): string => {
  const q = getSearchQuery(query);
  if (page <= 1) {
    return buildNaverSearchUrl(query);
  }
  return `https://search.naver.com/search.naver?nso=&page=${page}&query=${encodeURIComponent(
    q
  )}&sm=tab_pge&ssc=tab.ur.all&start=1`;
};

export const fetchHtml = async (url: string): Promise<string> => {
  const client = await getGotScrapingClient();
  const cookie = buildNaverCookie();

  const headers: Record<string, string> = {
    Referer: 'https://www.naver.com/',
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  const response = await client.get(url, {
    headerGeneratorOptions: {
      browsers: ['chrome'],
      devices: ['desktop'],
      operatingSystems: ['windows'],
      locales: ['ko-KR'],
    },
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

export const fetchHtmlWithoutCookie = async (url: string): Promise<string> => {
  const client = await getGotScrapingClient();

  const response = await client.get(url, {
    headerGeneratorOptions: {
      browsers: ['chrome'],
      devices: ['desktop'],
      operatingSystems: ['windows'],
      locales: ['ko-KR'],
    },
    headers: {
      Referer: 'https://www.naver.com/',
    },
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
      const html = await fetchHtml(url);

      return html;
    } catch (error) {
      const err = error as Error & { status?: number };
      const is403 = err.status === 403;

      if (attempt < maxRetries) {
        const baseDelay = is403 ? 60000 : 30000;
        const backoff = baseDelay * attempt;
        const jitter = Math.floor(Math.random() * 1000);

        logger.warn(
          `${err.message} - ${attempt}/${maxRetries} 재시도 (${Math.round(
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

export const crawlWithRetryWithoutCookie = async (
  query: string,
  maxRetries: number = 2
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = buildNaverSearchUrl(query);
      const html = await fetchHtmlWithoutCookie(url);
      return html;
    } catch (error) {
      const err = error as Error & { status?: number };
      const is403 = err.status === 403;

      if (attempt < maxRetries) {
        const baseDelay = is403 ? 60000 : 30000;
        const backoff = baseDelay * attempt;
        const jitter = Math.floor(Math.random() * 1000);

        logger.warn(
          `[비로그인] ${err.message} - ${attempt}/${maxRetries} 재시도 (${Math.round(
            (backoff + jitter) / 1000
          )}초 대기)`
        );

        await delay(backoff + jitter);
      } else {
        throw error;
      }
    }
  }

  throw new Error('비로그인 크롤링 실패');
};

export const crawlMultiPagesWithRetry = async (
  query: string,
  maxPages: number = 4,
  maxRetries: number = 3
): Promise<string[]> => {
  const htmls: string[] = [];

  for (let page = 1; page <= maxPages; page++) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = buildNaverSearchUrlWithPage(query, page);
        const html = await fetchHtml(url);
        htmls.push(html);

        if (page < maxPages) {
          await randomDelay(500, 1000);
        }
        break;
      } catch (error) {
        const err = error as Error & { status?: number };
        const is403 = err.status === 403;

        if (attempt < maxRetries) {
          const baseDelay = is403 ? 60000 : 30000;
          const backoff = baseDelay * attempt;
          const jitter = Math.floor(Math.random() * 1000);

          logger.warn(
            `[페이지${page}] ${err.message} - ${attempt}/${maxRetries} 재시도 (${Math.round(
              (backoff + jitter) / 1000
            )}초 대기)`
          );

          await delay(backoff + jitter);
        } else {
          logger.warn(`[페이지${page}] 크롤링 실패, 스킵`);
        }
      }
    }
  }

  if (htmls.length === 0) {
    throw new Error('다중 페이지 크롤링 실패');
  }

  return htmls;
};
