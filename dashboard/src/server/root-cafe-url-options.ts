import { InvalidJobInputError } from './job-errors';

/** 봇 쪽 sourceIdFromUrl(src/lib/custom-cafe-blog-check/sheet.ts)과 같은 패턴. */
const CAFE_URL_PATTERN = /^https?:\/\/(?:m\.)?cafe\.naver\.com\/[^/?#\s]+(?:\/\d+)?\/?$/i;

export interface RootCafeUrlRunOptions {
  url: string;
}

export const buildRootCafeUrlArgs = (input: unknown): string[] => {
  if (typeof input !== 'object' || input === null || !('url' in input)) {
    throw new InvalidJobInputError('카페 URL을 입력해야 함');
  }

  const { url } = input as { url: unknown };
  if (typeof url !== 'string') {
    throw new InvalidJobInputError('카페 URL은 문자열이어야 함');
  }

  const trimmed = url.trim();
  if (!CAFE_URL_PATTERN.test(trimmed)) {
    throw new InvalidJobInputError(
      '카페 URL 형식이 올바르지 않음 (예: https://cafe.naver.com/카페아이디/게시글번호)'
    );
  }

  return [`--url=${trimmed}`];
};
