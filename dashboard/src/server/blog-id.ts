/**
 * 블로그 ID 정규화. 봇 쪽 src/lib/blog-id-overrides의 normalizeBlogId와 같은 규칙이다.
 *
 * 계정 관리와 프리셋이 같이 쓰는 규칙이라 mongoose를 끌고 오지 않는 별도 모듈로 둔다.
 */
export const normalizeBlogId = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  const fromUrl = trimmed.match(/(?:m\.)?blog\.naver\.com\/([^/?&#\s]+)/)?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/[/?&#].*$/, '');
  return /^[a-z0-9_-]{2,40}$/.test(candidate) ? candidate : '';
};
