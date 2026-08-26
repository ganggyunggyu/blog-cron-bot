import { parseNaverCafeUrl } from '../naver-cafe-url';

/**
 * 붙여넣은 한 줄을 카페인지 블로그인지 가른다.
 *
 * 사용자는 주소를 그대로 붙여넣는다. 어느 쪽인지 고르게 하면 잘못 고를 수 있고,
 * 주소에 이미 답이 적혀 있다.
 *
 * 아이디만 적은 줄은 어느 쪽인지 알 수 없으므로 양쪽 후보로 둔다. 매칭은 아이디가
 * 정확히 같을 때만 성립하므로, 카페 아이디를 블로그 목록에 같이 넣어도 엉뚱한 게
 * 걸리지 않는다.
 */
export interface NaverTargetInput {
  cafeIds: string[];
  blogIds: string[];
  /** 주소도 아이디도 아니라 버린 줄. 화면에서 그대로 알려준다. */
  ignored: string[];
}

const BLOG_URL_PATTERN =
  /^https?:\/\/(?:m\.)?blog\.naver\.com\/([^/?#\s]+)/i;
const BARE_ID_PATTERN = /^[A-Za-z0-9_-]{2,}$/;

const dedupe = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean)));

export const parseNaverTargetInputs = (
  lines: readonly string[]
): NaverTargetInput => {
  const cafeIds: string[] = [];
  const blogIds: string[] = [];
  const ignored: string[] = [];

  lines
    .map((line) => String(line ?? '').trim())
    .filter(Boolean)
    .forEach((line) => {
      const cafe = parseNaverCafeUrl(line);
      if (cafe.ok) {
        cafeIds.push(cafe.cafeId);
        return;
      }

      const blogId = line.match(BLOG_URL_PATTERN)?.[1];
      if (blogId) {
        blogIds.push(blogId.toLowerCase());
        return;
      }

      // 주소 형태인데 위 둘 다 아니면(다른 사이트, 새 카페 주소 체계 등) 버린다.
      if (/^https?:\/\//i.test(line)) {
        ignored.push(line);
        return;
      }

      if (BARE_ID_PATTERN.test(line)) {
        const id = line.toLowerCase();
        cafeIds.push(id);
        blogIds.push(id);
        return;
      }

      ignored.push(line);
    });

  return {
    cafeIds: dedupe(cafeIds),
    blogIds: dedupe(blogIds),
    ignored: dedupe(ignored),
  };
};
