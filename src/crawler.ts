import { NAVER_DESKTOP_HEADERS } from './constants';

export const buildNaverSearchUrl = (query: string): string => {
  return `https://search.naver.com/search.naver?where=nexearch&sm=top_sly.hst&fbm=0&acr=1&ie=utf8&query=${encodeURIComponent(query)}`;
};

export const fetchHtml = async (url: string, headers: Record<string, string>): Promise<string> => {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const crawlWithRetry = async (
  query: string,
  maxRetries: number = 3
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [시도 ${attempt}/${maxRetries}] 검색어: ${query}`);

      const url = buildNaverSearchUrl(query);
      const html = await fetchHtml(url, NAVER_DESKTOP_HEADERS);

      console.log(`✅ 성공! HTML 크롤링 완료`);

      return html;
    } catch (error) {
      console.error(`❌ 실패 (시도 ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        console.log('⏳ 30초 후 재시도...');
        await delay(30000);
      } else {
        console.error('❌ 최대 재시도 횟수 초과');
        throw error;
      }
    }
  }

  throw new Error('크롤링 실패');
};
