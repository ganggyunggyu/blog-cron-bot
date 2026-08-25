import { InvalidJobInputError } from './job-errors';

/**
 * 봇 쪽 src/lib/naver-cafe-url/index.ts와 같은 판정을 해야 한다.
 * 기준 목록은 src/lib/naver-cafe-url/cases.json 하나뿐이고, 양쪽 테스트가 그걸 읽는다.
 * (대시보드에서 봇 코드를 직접 import하면 mongoose까지 Next 번들에 딸려온다.)
 */
export type CafeUrlParseFailure = 'empty' | 'not-cafe-url' | 'numeric-cafe-id';

export const CAFE_URL_FAILURE_MESSAGES: Record<CafeUrlParseFailure, string> = {
  empty: '카페 글 주소를 넣어야 함',
  'not-cafe-url':
    '네이버 카페 주소가 아님 (예: https://cafe.naver.com/카페이름/12345)',
  'numeric-cafe-id':
    '카페 이름이 없는 주소임. 카페에서 글을 열고 주소창에 뜨는 cafe.naver.com/카페이름/글번호 형태로 넣어야 함',
};

const SPA_PATH_PREFIXES = new Set(['f-e', 'ca-fe']);

export interface CafeUrlTarget {
  cafeId: string;
  articleId: string;
}

export type CafeUrlParseResult =
  | ({ ok: true } & CafeUrlTarget)
  | { ok: false; reason: CafeUrlParseFailure };

const stripQueryAndHash = (value: string): string =>
  value.split('#')[0].split('?')[0];

export const parseNaverCafeUrl = (rawUrl: unknown): CafeUrlParseResult => {
  const url = String(rawUrl ?? '').trim();
  if (!url) return { ok: false, reason: 'empty' };

  const afterHost = url.match(
    /^https?:\/\/(?:m\.)?cafe\.naver\.com\/(.*)$/i,
  )?.[1];
  if (afterHost === undefined) return { ok: false, reason: 'not-cafe-url' };

  const segments = stripQueryAndHash(afterHost)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const [first, second] = segments;
  if (!first) return { ok: false, reason: 'not-cafe-url' };
  if (SPA_PATH_PREFIXES.has(first.toLowerCase())) {
    return { ok: false, reason: 'numeric-cafe-id' };
  }
  if (/^\d+$/.test(first)) return { ok: false, reason: 'numeric-cafe-id' };

  return {
    ok: true,
    cafeId: first.toLowerCase(),
    articleId: second && /^\d+$/.test(second) ? second : '',
  };
};

export interface RootCafeUrlRunOptions {
  url: string;
}

export const buildRootCafeUrlArgs = (input: unknown): string[] => {
  if (typeof input !== 'object' || input === null || !('url' in input)) {
    throw new InvalidJobInputError(CAFE_URL_FAILURE_MESSAGES.empty);
  }

  const { url } = input as { url: unknown };
  if (typeof url !== 'string') {
    throw new InvalidJobInputError(CAFE_URL_FAILURE_MESSAGES['not-cafe-url']);
  }

  const parsed = parseNaverCafeUrl(url);
  if (!parsed.ok) {
    throw new InvalidJobInputError(CAFE_URL_FAILURE_MESSAGES[parsed.reason]);
  }

  return [`--url=${url.trim()}`];
};
