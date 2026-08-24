import {
  crawlWithRetry,
  crawlWithRetryWithoutCookie,
  randomDelay,
} from '../../crawler';
import { extractPopularItems } from '../../parser';
import {
  buildCafeExposureRow,
  matchCafeTargets,
  type CafeExposureRow,
  type CafeTarget,
} from '../cafe-exposure-check';
import { emitExposureProgress } from '../exposure-progress';
import { sourceIdFromUrl } from '../custom-cafe-blog-check/sheet';

/**
 * 사용자가 붙여넣은 카페 URL 하나를 카페 노출체크 대상으로 바꾼다.
 *
 * cafe.naver.com/{카페아이디}(/{글번호}) 형태만 받는다. 카페 아이디를 못 뽑으면
 * 명령 인자가 아예 잘못된 것이므로 여기서 바로 실패시킨다.
 */
export const parseCafeUrlTarget = (rawUrl: string): CafeTarget => {
  const url = String(rawUrl ?? '').trim();
  const cafeId = sourceIdFromUrl(url);
  if (!url || !cafeId) {
    throw new Error(
      '카페 URL 형식이 올바르지 않음 (예: https://cafe.naver.com/카페아이디/게시글번호)'
    );
  }
  return { name: cafeId, ids: [cafeId] };
};

const checkKeyword = async (
  keyword: string,
  target: CafeTarget
): Promise<CafeExposureRow> => {
  try {
    let html: string;
    try {
      html = await crawlWithRetry(keyword, 1);
    } catch {
      await randomDelay(900, 1400);
      html = await crawlWithRetryWithoutCookie(keyword, 1);
    }
    const items = extractPopularItems(html, { includeCafe: true });
    return buildCafeExposureRow(keyword, matchCafeTargets(items, [target]));
  } catch (error) {
    return buildCafeExposureRow(keyword, [], (error as Error).message || 'Unknown error');
  }
};

/**
 * 루트 키워드 전체에서 카페 URL 하나가 노출되는지 확인한다.
 *
 * 계정 목록이 아니라 사용자가 그때그때 붙여넣는 단발성 URL이라 등록 계정 매칭
 * (matchBlogs)은 쓰지 않고 카페 매칭만 본다.
 */
export const checkRootCafeUrlExposure = async (
  keywords: string[],
  target: CafeTarget,
  concurrency = 8
): Promise<Map<string, CafeExposureRow>> => {
  const results = new Map<string, CafeExposureRow>();
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(
    Math.max(1, Math.floor(concurrency) || 8),
    Math.max(keywords.length, 1)
  );
  const worker = async (): Promise<void> => {
    while (nextIndex < keywords.length) {
      const index = nextIndex++;
      const keyword = keywords[index];
      results.set(keyword, await checkKeyword(keyword, target));
      completed += 1;
      emitExposureProgress('root', completed, keywords.length, 'running');
      await randomDelay(250, 500);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  for (const keyword of keywords) {
    if (results.get(keyword)?.exposureStatus !== '확인실패') continue;
    await randomDelay(900, 1400);
    results.set(keyword, await checkKeyword(keyword, target));
  }
  return results;
};
