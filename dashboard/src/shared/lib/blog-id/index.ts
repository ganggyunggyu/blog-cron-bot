/**
 * 블로그 ID 정규화와 붙여넣기 파싱.
 *
 * 정규화 규칙은 봇 쪽 src/lib/blog-id-overrides의 normalizeBlogId와 같아야 한다.
 * 서버(@/server/blog-id)도 이 모듈을 그대로 다시 내보내 규칙을 한 곳에서만 고친다.
 */
export const normalizeBlogId = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  const fromUrl = trimmed.match(/(?:m\.)?blog\.naver\.com\/([^/?&#\s]+)/)?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/[/?&#].*$/, '');
  return /^[a-z0-9_-]{2,40}$/.test(candidate) ? candidate : '';
};

/** 주소 뒤에 확장자가 붙는 PostList.naver 같은 경로는 아이디로 잡지 않는다. */
const BLOG_URL_PATTERN = /(?:m\.)?blog\.naver\.com\/([a-z0-9_-]{2,40})(?![\w.-])/gi;
const BLOG_ID_PARAM_PATTERN = /blogid=([a-z0-9_-]{2,40})/gi;
const PLAIN_ID_PATTERN = /^[a-z0-9_-]{2,40}$/;

export type PasteParseMode = 'url' | 'plain';

export interface PastedBlogIds {
  blogIds: string[];
  /**
   * url: 주소가 하나라도 있으면 주소에서만 뽑는다. 시트를 통째로 복사해도
   *      비밀번호나 메모 칸이 섞이지 않는다.
   * plain: 주소가 아예 없으면 아이디만 나열한 목록으로 보고 칸을 그대로 읽는다.
   */
  mode: PasteParseMode;
}

const collect = (text: string, pattern: RegExp): string[] =>
  Array.from(text.matchAll(pattern), (match) => normalizeBlogId(match[1])).filter(
    (blogId) => blogId.length > 0,
  );

export const parsePastedBlogIds = (text: string): PastedBlogIds => {
  const source = String(text ?? '');
  const hasUrl = /blog\.naver\.com/i.test(source);

  const found = hasUrl
    ? [...collect(source, BLOG_URL_PATTERN), ...collect(source, BLOG_ID_PARAM_PATTERN)]
    : source
        .split(/[\s,;|]+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => PLAIN_ID_PATTERN.test(token));

  return { blogIds: Array.from(new Set(found)), mode: hasUrl ? 'url' : 'plain' };
};
