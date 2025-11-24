import { NAVER_MOBILE_HEADERS } from './constants';
import { getSearchQuery } from './utils';

export const buildNaverSearchUrl = (query: string): string => {
  const q = getSearchQuery(query);
  return `https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
};

export const fetchHtml = async (
  url: string,
  headers: Record<string, string>
): Promise<string> => {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
};

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const crawlWithRetry = async (
  query: string,
  maxRetries: number = 3
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = buildNaverSearchUrl(query);
      const html = await fetchHtml(url, NAVER_MOBILE_HEADERS);

      return html;
    } catch (error) {
      if (attempt < maxRetries) {
        await delay(30000);
      } else {
        throw error;
      }
    }
  }

  throw new Error('크롤링 실패');
};
