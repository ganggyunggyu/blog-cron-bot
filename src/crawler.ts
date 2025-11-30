import { getRandomHeaders } from './constants';
import { getSearchQuery } from './utils';

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
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`) as Error & {
      status: number;
    };
    error.status = response.status;
    throw error;
  }

  return await response.text();
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
