/**
 * 붙여넣은 줄을 카페와 블로그로 가른다.
 *
 * 봇 쪽 src/lib/naver-target-input/index.ts와 같은 판정을 해야 한다. 한쪽만 고치면
 * 화면이 보여주는 개수와 실제로 확인하는 대상이 달라진다. 두 테스트가 같은 목록
 * (src/lib/naver-target-input/cases.json)을 읽는다.
 */
export interface NaverTargetInput {
  cafeIds: string[];
  blogIds: string[];
  ignored: string[];
}

const CAFE_URL_PATTERN = /^https?:\/\/(?:m\.)?cafe\.naver\.com\/(.*)$/i;
const BLOG_URL_PATTERN = /^https?:\/\/(?:m\.)?blog\.naver\.com\/([^/?#\s]+)/i;
const BARE_ID_PATTERN = /^[A-Za-z0-9_-]{2,}$/;
const SPA_PREFIXES = new Set(['f-e', 'ca-fe']);

const dedupe = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean)));

const readCafeId = (line: string): string | null => {
  const afterHost = line.match(CAFE_URL_PATTERN)?.[1];
  if (afterHost === undefined) return null;
  const first = afterHost.split('#')[0].split('?')[0].split('/').filter(Boolean)[0];
  if (!first) return null;
  // 카페를 숫자로 가리키는 새 주소 체계는 검색 결과의 카페 아이디와 맞춰볼 수 없다.
  if (SPA_PREFIXES.has(first.toLowerCase()) || /^\d+$/.test(first)) return null;
  return first.toLowerCase();
};

export const parseNaverTargetInputs = (
  lines: readonly string[],
): NaverTargetInput => {
  const cafeIds: string[] = [];
  const blogIds: string[] = [];
  const ignored: string[] = [];

  lines
    .map((line) => String(line ?? '').trim())
    .filter(Boolean)
    .forEach((line) => {
      const cafeId = readCafeId(line);
      if (cafeId) {
        cafeIds.push(cafeId);
        return;
      }

      const blogId = line.match(BLOG_URL_PATTERN)?.[1];
      if (blogId) {
        blogIds.push(blogId.toLowerCase());
        return;
      }

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
