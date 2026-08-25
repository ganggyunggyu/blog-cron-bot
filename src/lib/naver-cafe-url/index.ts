/**
 * 네이버 카페 주소 한 줄을 카페 아이디와 글 번호로 가른다.
 *
 * 화면(대시보드)과 봇 CLI가 각각 주소를 검사하는데, 둘이 서로 다른 걸 통과시키면
 * 화면은 막았는데 CLI는 쓰레기 값을 받아 전 키워드 미노출로 끝나는 일이 생긴다.
 * 그래서 통과/거절 기준을 이 파일 하나에 적고, 양쪽 테스트가 같은 목록
 * (naver-cafe-url-cases.json)을 읽어 검사한다.
 */

export type CafeUrlParseFailure =
  | 'empty'
  | 'not-cafe-url'
  | 'numeric-cafe-id';

export interface CafeUrlTarget {
  cafeId: string;
  /** 주소에 글 번호가 없으면 빈 문자열. 카페 단위로만 확인한다는 뜻이다. */
  articleId: string;
}

export type CafeUrlParseResult =
  | ({ ok: true } & CafeUrlTarget)
  | { ok: false; reason: CafeUrlParseFailure };

export const CAFE_URL_FAILURE_MESSAGES: Record<CafeUrlParseFailure, string> = {
  empty: '카페 글 주소를 넣어야 함',
  'not-cafe-url':
    '네이버 카페 주소가 아님 (예: https://cafe.naver.com/카페이름/12345)',
  'numeric-cafe-id':
    '카페 이름이 없는 주소임. 카페에서 글을 열고 주소창에 뜨는 cafe.naver.com/카페이름/글번호 형태로 넣어야 함',
};

/** cafe.naver.com 뒤 첫 칸이 이 값이면 카페 이름이 아니라 새 주소 체계의 경로다. */
const SPA_PATH_PREFIXES = new Set(['f-e', 'ca-fe']);

const stripQueryAndHash = (value: string): string =>
  value.split('#')[0].split('?')[0];

export const parseNaverCafeUrl = (rawUrl: unknown): CafeUrlParseResult => {
  const url = String(rawUrl ?? '').trim();
  if (!url) return { ok: false, reason: 'empty' };

  const afterHost = url.match(
    /^https?:\/\/(?:m\.)?cafe\.naver\.com\/(.*)$/i
  )?.[1];
  if (afterHost === undefined) return { ok: false, reason: 'not-cafe-url' };

  const segments = stripQueryAndHash(afterHost)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const [first, second] = segments;
  if (!first) return { ok: false, reason: 'not-cafe-url' };

  // cafe.naver.com/f-e/cafes/12345678/articles/9 처럼 카페를 숫자로 가리키는 주소는
  // 검색 결과가 주는 카페 아이디(영문 이름)와 맞춰볼 수가 없다. 조용히 "f-e"를
  // 카페 아이디로 삼는 대신 사용자에게 다른 주소를 달라고 한다.
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

/** 검색 결과로 나온 카페 글 주소에서 같은 기준으로 아이디와 글 번호를 뽑는다. */
export const extractCafeRefFromLink = (link: unknown): CafeUrlTarget | null => {
  const parsed = parseNaverCafeUrl(link);
  return parsed.ok ? { cafeId: parsed.cafeId, articleId: parsed.articleId } : null;
};
