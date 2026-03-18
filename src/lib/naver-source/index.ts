export type NaverSourceType = 'blog' | 'cafe' | 'unknown';

export interface NaverSourceIdentity {
  type: NaverSourceType;
  id: string;
}

const NAVER_SEARCH_BASE_URL = 'https://search.naver.com';

const decodeUrl = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeCafeName = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();

export const resolveNaverSearchResultUrl = (
  href: string,
  fallbackUrl?: string
): string => {
  const preferredUrl = String(fallbackUrl ?? '').trim();
  if (preferredUrl) {
    return decodeUrl(preferredUrl);
  }

  const candidate = String(href ?? '').trim();
  if (!candidate) return '';

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  try {
    const parsedUrl = new URL(candidate, NAVER_SEARCH_BASE_URL);
    const encodedUrl =
      parsedUrl.searchParams.get('u') || parsedUrl.searchParams.get('url');

    if (encodedUrl) {
      return decodeUrl(encodedUrl);
    }

    return parsedUrl.toString();
  } catch {
    return candidate;
  }
};

export const extractBlogIdFromUrl = (url: string): string => {
  const candidate = String(url ?? '').trim();
  if (!candidate) return '';

  const urlPatterns = [
    /blog\.naver\.com\/([^/?&#]+)/i,
    /in\.naver\.com\/([^/?&#]+)/i,
    /m\.blog\.naver\.com\/([^/?&#]+)/i,
  ];

  for (const pattern of urlPatterns) {
    const match = candidate.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  try {
    const parsedUrl = new URL(candidate, 'https://blog.naver.com');
    const pathSegments = parsedUrl.pathname.replace(/^\/+/, '').split('/');

    if (pathSegments.length >= 2 && pathSegments[0] !== 'PostView.naver') {
      return pathSegments[0].toLowerCase();
    }

    if (parsedUrl.pathname.includes('PostView.naver')) {
      return (parsedUrl.searchParams.get('blogId') || '').toLowerCase();
    }
  } catch {}

  return '';
};

export const extractCafeIdFromUrl = (url: string): string => {
  const candidate = String(url ?? '').trim();
  if (!candidate) return '';

  try {
    const parsedUrl = new URL(candidate, 'https://cafe.naver.com');
    const cafeUrlParam =
      parsedUrl.searchParams.get('cafeUrl') ||
      parsedUrl.searchParams.get('cafeurl');

    if (cafeUrlParam) {
      return cafeUrlParam.toLowerCase();
    }

    const pathSegments = parsedUrl.pathname.replace(/^\/+/, '').split('/');

    if (
      pathSegments.length >= 3 &&
      pathSegments[0] === 'ca-fe' &&
      pathSegments[1] === 'cafes'
    ) {
      return (pathSegments[2] || '').toLowerCase();
    }

    if (pathSegments[0] && pathSegments[0] !== 'ca-fe') {
      return pathSegments[0].toLowerCase();
    }
  } catch {}

  const cafeUrlPatterns = [
    /(?:m\.)?cafe\.naver\.com\/ca-fe\/cafes\/([^/?&#]+)/i,
    /(?:m\.)?cafe\.naver\.com\/([^/?&#]+)/i,
    /\/cafes\/([^/?&#]+)/i,
  ];

  for (const pattern of cafeUrlPatterns) {
    const match = candidate.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  return '';
};

export const detectNaverSource = (url: string): NaverSourceIdentity => {
  const blogId = extractBlogIdFromUrl(url);
  if (blogId) {
    return { type: 'blog', id: blogId };
  }

  const cafeId = extractCafeIdFromUrl(url);
  if (cafeId) {
    return { type: 'cafe', id: cafeId };
  }

  return { type: 'unknown', id: '' };
};
