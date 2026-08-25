import {
  crawlWithRetry,
  crawlWithRetryWithoutCookie,
  randomDelay,
} from '../../crawler';
import { extractPopularItems, type PopularItem } from '../../parser';
import { emitExposureProgress } from '../exposure-progress';
import { getExposureConcurrency } from '../exposure-run-config';
import {
  extractCafeRefFromLink,
  type CafeUrlTarget,
} from '../naver-cafe-url';

/** 진행률 채널. 대시보드의 EXPOSURE_PROGRESS_LABELS에 같은 키가 있어야 이름이 뜬다. */
export const ROOT_CAFE_URL_PROGRESS_TARGET = 'root-cafe-url';

export type RootCafeUrlStatus =
  | '노출'
  | '같은 카페 다른 글'
  | '미노출'
  | '확인실패';

export interface RootCafeUrlRow {
  keyword: string;
  status: RootCafeUrlStatus;
  /** 인기글 목록에서 몇 번째로 나왔는지. 미노출이면 빈 문자열. */
  rank: string;
  /** 실제로 걸린 글 주소. 내 글이 맞는지 눈으로 확인할 수 있게 남긴다. */
  link: string;
  /** 확인실패일 때만 채운다. */
  error: string;
}

const buildRow = (
  keyword: string,
  overrides: Partial<RootCafeUrlRow> = {}
): RootCafeUrlRow => ({
  keyword,
  status: '미노출',
  rank: '',
  link: '',
  error: '',
  ...overrides,
});

/**
 * 검색 결과에서 이 카페 글을 찾는다.
 *
 * 카페 아이디로만 맞춘다. 공용 matchCafeTargets는 target.name을 카페 "표시 이름"으로
 * 보고 부분 문자열까지 맞다고 처리하는데, 여기 name에 넣을 수 있는 건 주소에서 뽑은
 * 아이디뿐이라 그 경로를 타면 이름이 "table"인 남의 카페가 localtable702에 걸린다.
 *
 * 붙여넣은 주소에 글 번호가 있으면 그 글까지 같은지 구분해서 알려준다. 같은 카페의
 * 다른 글이 걸린 걸 내 글이 노출됐다고 읽으면 안 된다.
 */
export const findCafeUrlExposure = (
  keyword: string,
  items: readonly PopularItem[],
  target: CafeUrlTarget
): RootCafeUrlRow => {
  let sameCafeFallback: RootCafeUrlRow | null = null;

  for (const [index, item] of items.entries()) {
    if (item.sourceType !== 'cafe') continue;

    const ref =
      extractCafeRefFromLink(item.link) ??
      (item.sourceId
        ? { cafeId: String(item.sourceId).toLowerCase(), articleId: '' }
        : null);
    if (!ref || ref.cafeId !== target.cafeId) continue;

    const rank = String(index + 1);
    const isSameArticle =
      target.articleId !== '' && ref.articleId === target.articleId;

    if (target.articleId === '' || isSameArticle) {
      return buildRow(keyword, { status: '노출', rank, link: item.link });
    }

    sameCafeFallback ??= buildRow(keyword, {
      status: '같은 카페 다른 글',
      rank,
      link: item.link,
    });
  }

  return sameCafeFallback ?? buildRow(keyword);
};

const checkKeyword = async (
  keyword: string,
  target: CafeUrlTarget
): Promise<RootCafeUrlRow> => {
  try {
    let html: string;
    try {
      html = await crawlWithRetry(keyword);
    } catch {
      await randomDelay(900, 1400);
      html = await crawlWithRetryWithoutCookie(keyword);
    }
    // includeCafe를 빼면 파서가 카페 결과를 통째로 버려서 항상 미노출이 된다.
    const items = extractPopularItems(html, { includeCafe: true });
    return findCafeUrlExposure(keyword, items, target);
  } catch (error) {
    return buildRow(keyword, {
      status: '확인실패',
      error: (error as Error).message || '알 수 없는 오류',
    });
  }
};

/** 한 번에 몇 개씩 볼지. 실행마다 EXPOSURE_CONCURRENCY로 조절할 수 있어야 한다. */
const resolveWorkerCount = (
  requested: number | undefined,
  keywordCount: number
): number => {
  const base = requested ?? getExposureConcurrency();
  const normalized = Math.max(1, Math.floor(base) || 8);
  return Math.min(normalized, Math.max(keywordCount, 1));
};

/** 주어진 키워드를 병렬로 훑고 결과를 results에 채운다. */
const runPass = async (
  keywords: readonly string[],
  target: CafeUrlTarget,
  results: Map<string, RootCafeUrlRow>,
  workerCount: number,
  onProgress: () => void
): Promise<void> => {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < keywords.length) {
      const keyword = keywords[nextIndex++];
      results.set(keyword, await checkKeyword(keyword, target));
      onProgress();
      await randomDelay(250, 500);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
};

export const checkRootCafeUrlExposure = async (
  keywords: string[],
  target: CafeUrlTarget,
  concurrency?: number
): Promise<Map<string, RootCafeUrlRow>> => {
  const results = new Map<string, RootCafeUrlRow>();
  const workerCount = resolveWorkerCount(concurrency, keywords.length);
  let completed = 0;
  // 'root'로 쏘면 진짜 루트 노출체크의 진행바를 이 작업 숫자로 덮어쓴다.
  const onProgress = () => {
    completed += 1;
    emitExposureProgress(
      ROOT_CAFE_URL_PROGRESS_TARGET,
      completed,
      keywords.length,
      'running'
    );
  };

  await runPass(keywords, target, results, workerCount, onProgress);

  // 재시도도 병렬로 돈다. 예전엔 여기서 한 개씩 순서대로 돌았는데, 403이 몰린 실행에서
  // 이 꼬리 하나가 전체 시간의 대부분을 먹었다(같은 작업이 5분과 20분으로 갈렸다).
  const failedKeywords = keywords.filter(
    (keyword) => results.get(keyword)?.status === '확인실패'
  );
  if (failedKeywords.length > 0) {
    await randomDelay(900, 1400);
    await runPass(
      failedKeywords,
      target,
      results,
      resolveWorkerCount(concurrency, failedKeywords.length),
      () => undefined
    );
  }
  return results;
};
