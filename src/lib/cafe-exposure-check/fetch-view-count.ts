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

export interface CafeArticleInfo {
  viewCount: string;
  writeDate: string;
}

const formatWriteDate = (raw: unknown): string => {
  if (!raw) return '';
  const ts = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) return String(raw);
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const extractArticleInfo = (data: Record<string, unknown>): CafeArticleInfo => {
  const article = (data as any)?.result?.article;
  const readCount = article?.readCount;
  const writeDate = article?.writeDateTimestamp ?? article?.writeDate ?? '';
  return {
    viewCount: readCount != null ? String(readCount) : '',
    writeDate: formatWriteDate(writeDate),
  };
};

export const fetchCafeArticleInfo = async (link: string): Promise<CafeArticleInfo> => {
  const empty: CafeArticleInfo = { viewCount: '', writeDate: '' };
  if (!link) return empty;

  const parsed = parseCafeLink(link);
  if (!parsed) return empty;

  const apiUrl = buildArticleApiUrl(parsed.cafeUrl, parsed.articleId);

  try {
    const json = await fetchHtml(apiUrl);
    const data = JSON.parse(json);
    const info = extractArticleInfo(data);
    if (info.viewCount) return info;
  } catch {
    // 로그인 쿠키 실패 시 비로그인으로 재시도
  }

  try {
    const json = await fetchHtmlWithoutCookie(apiUrl);
    const data = JSON.parse(json);
    return extractArticleInfo(data);
  } catch (error) {
    logger.warn(`조회수 수집 실패 (${link}): ${(error as Error).message}`);
    return empty;
  }
};

export const fetchCafeViewCount = async (link: string): Promise<string> => {
  const { viewCount } = await fetchCafeArticleInfo(link);
  return viewCount;
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
