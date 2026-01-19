import { getSearchQuery } from './utils';
import 'dotenv/config';
import { logger } from './lib/logger';
import {
  NAVER_SEARCH_BASE_URL,
  NAVER_REFERER_URL,
  HEADER_GENERATOR_OPTIONS,
  ACKEY_CHARS,
  ACKEY_LENGTH,
  TIMEOUT,
  DELAY,
  RETRY,
  PAGINATION,
} from './constants/crawl-config';

type GotScrapingClient = typeof import('got-scraping').gotScraping;

export const buildNaverCookie = (): string | undefined => {
  const { NAVER_NID_AUT: nidAut, NAVER_NID_SES: nidSes, NAVER_M_LOC: mLoc } = process.env;

  if (nidAut && nidSes) {
    let cookie = `NID_AUT=${nidAut}; NID_SES=${nidSes}`;
    if (mLoc) {
      cookie += `; m_loc=${mLoc}`;
    }
    return cookie;
  }
  return undefined;
};

const generateAckey = (): string =>
  Array.from({ length: ACKEY_LENGTH }, () =>
    ACKEY_CHARS.charAt(Math.floor(Math.random() * ACKEY_CHARS.length))
  ).join('');

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
  return `${NAVER_SEARCH_BASE_URL}?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(q)}&ackey=${generateAckey()}`;
};

export const buildNaverSearchUrlWithPage = (query: string, page: number): string => {
  const q = getSearchQuery(query);
  if (page <= 1) {
    return buildNaverSearchUrl(query);
  }
  return `${NAVER_SEARCH_BASE_URL}?nso=&page=${page}&query=${encodeURIComponent(q)}&sm=tab_pge&ssc=tab.nx.all&start=1`;
};

export const fetchHtml = async (url: string): Promise<string> => {
  const client = await getGotScrapingClient();
  const cookie = buildNaverCookie();

  const headers: Record<string, string> = {
    Referer: NAVER_REFERER_URL,
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  const response = await client.get(url, {
    headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
    headers,
    http2: true,
    timeout: { request: TIMEOUT.REQUEST },
    throwHttpErrors: false,
  });

  const status = response.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    const error = new Error(`HTTP ${status}`) as Error & { status: number };
    error.status = status;
    throw error;
  }

  return response.body;
};

export const fetchHtmlWithoutCookie = async (url: string): Promise<string> => {
  const client = await getGotScrapingClient();

  const response = await client.get(url, {
    headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
    headers: {
      Referer: NAVER_REFERER_URL,
    },
    http2: true,
    timeout: { request: TIMEOUT.REQUEST },
    throwHttpErrors: false,
  });

  const status = response.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    const error = new Error(`HTTP ${status}`) as Error & { status: number };
    error.status = status;
    throw error;
  }

  return response.body;
};

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const randomDelay = (min: number, max: number): Promise<void> =>
  delay(Math.floor(Math.random() * (max - min + 1)) + min);

const calculateRetryDelay = (attempt: number, is403: boolean): number => {
  const baseDelay = is403 ? RETRY.DELAY_ON_403 : RETRY.DELAY_ON_ERROR;
  const backoff = baseDelay * attempt;
  const jitter = Math.floor(Math.random() * DELAY.RETRY_JITTER_MAX);
  return backoff + jitter;
};

export const crawlWithRetry = async (
  query: string,
  maxRetries: number = RETRY.DEFAULT_LOGIN_RETRIES
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = buildNaverSearchUrl(query);
      return await fetchHtml(url);
    } catch (error) {
      const err = error as Error & { status?: number };
      const is403 = err.status === 403;

      if (attempt < maxRetries) {
        const retryDelay = calculateRetryDelay(attempt, is403);

        logger.warn(
          `${err.message} - ${attempt}/${maxRetries} 재시도 (${Math.round(retryDelay / 1000)}초 대기)`
        );

        await delay(retryDelay);
      } else {
        throw error;
      }
    }
  }

  throw new Error('크롤링 실패');
};

export const crawlWithRetryWithoutCookie = async (
  query: string,
  maxRetries: number = RETRY.DEFAULT_GUEST_RETRIES
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = buildNaverSearchUrl(query);
      return await fetchHtmlWithoutCookie(url);
    } catch (error) {
      const err = error as Error & { status?: number };
      const is403 = err.status === 403;

      if (attempt < maxRetries) {
        const retryDelay = calculateRetryDelay(attempt, is403);

        logger.warn(
          `[비로그인] ${err.message} - ${attempt}/${maxRetries} 재시도 (${Math.round(retryDelay / 1000)}초 대기)`
        );

        await delay(retryDelay);
      } else {
        throw error;
      }
    }
  }

  throw new Error('비로그인 크롤링 실패');
};

export const crawlMultiPagesWithRetry = async (
  query: string,
  maxPages: number = PAGINATION.DEFAULT_MAX_PAGES,
  maxRetries: number = RETRY.DEFAULT_LOGIN_RETRIES
): Promise<string[]> => {
  const htmls: string[] = [];

  for (let page = 1; page <= maxPages; page++) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = buildNaverSearchUrlWithPage(query, page);
        const html = await fetchHtml(url);
        htmls.push(html);

        if (page < maxPages) {
          await randomDelay(DELAY.MULTI_PAGE_MIN, DELAY.MULTI_PAGE_MAX);
        }
        break;
      } catch (error) {
        const err = error as Error & { status?: number };
        const is403 = err.status === 403;

        if (attempt < maxRetries) {
          const retryDelay = calculateRetryDelay(attempt, is403);

          logger.warn(
            `[페이지${page}] ${err.message} - ${attempt}/${maxRetries} 재시도 (${Math.round(retryDelay / 1000)}초 대기)`
          );

          await delay(retryDelay);
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
