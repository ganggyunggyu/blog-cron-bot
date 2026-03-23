import { fetchHtml, fetchHtmlWithoutCookie, delay } from '../../crawler';
import { logger } from '../logger';

const VIEW_COUNT_DELAY = 500;
const CAFE_ARTICLE_API_BASE = 'https://apis.naver.com/cafe-web/cafe-articleapi/v2.1/cafes';

const parseCafeLink = (link: string): { cafeUrl: string; articleId: string } | null => {
  const match = link.match(/cafe\.naver\.com\/([^/?]+)\/(\d+)/);
  if (!match) {
    return null;
  }
  return { cafeUrl: match[1], articleId: match[2] };
};

const buildArticleApiUrl = (cafeUrl: string, articleId: string): string =>
  `${CAFE_ARTICLE_API_BASE}/${cafeUrl}/articles/${articleId}?useCafeId=false`;

export const fetchCafeViewCount = async (link: string): Promise<string> => {
  if (!link) {
    return '';
  }

  const parsed = parseCafeLink(link);
  if (!parsed) {
    return '';
  }

  const apiUrl = buildArticleApiUrl(parsed.cafeUrl, parsed.articleId);

  try {
    const json = await fetchHtml(apiUrl);
    const data = JSON.parse(json);
    const readCount = data?.result?.article?.readCount;
    if (readCount != null) {
      return String(readCount);
    }
  } catch {
    // 로그인 쿠키 실패 시 비로그인으로 재시도
  }

  try {
    const json = await fetchHtmlWithoutCookie(apiUrl);
    const data = JSON.parse(json);
    const readCount = data?.result?.article?.readCount;
    return readCount != null ? String(readCount) : '';
  } catch (error) {
    logger.warn(`조회수 수집 실패 (${link}): ${(error as Error).message}`);
    return '';
  }
};

export const fetchViewCountsForLinks = async (
  links: string[]
): Promise<Map<string, string>> => {
  const viewCounts = new Map<string, string>();

  for (const link of links) {
    if (!link) {
      continue;
    }

    const viewCount = await fetchCafeViewCount(link);
    viewCounts.set(link, viewCount);

    await delay(VIEW_COUNT_DELAY);
  }

  return viewCounts;
};
