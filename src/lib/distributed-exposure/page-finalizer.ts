import {
  getPageCheckKeywords,
  type IPageCheckKeyword,
  type PageCheckSheetType,
} from '../../database';
import { saveToCSV, saveToSheetCSV } from '../../csv-writer';
import { extractBlogId, type ExposureResult } from '../../matcher';
import { getKSTTimestamp } from '../../utils';
import { sendDoorayExposureResult } from '../dooray';

const LABELS: Record<'pet' | 'suripet', string> = {
  pet: '애견',
  suripet: '서리펫',
};

const toExposureResult = (keyword: IPageCheckKeyword): ExposureResult => ({
  query: keyword.keyword,
  company: keyword.company,
  blogId: extractBlogId(keyword.url),
  blogName: '',
  postTitle: keyword.matchedTitle ?? '',
  postLink: keyword.url,
  postPublishedAt: keyword.postPublishedAt,
  exposureType: keyword.popularTopic,
  topicName: keyword.popularTopic,
  position: keyword.rank ?? 0,
  positionWithCafe: keyword.rankWithCafe,
  isNewLogic: keyword.isNewLogic,
  page: keyword.foundPage,
});

export const assertCompletePageExposureResults = (
  target: Extract<PageCheckSheetType, 'pet' | 'suripet'>,
  keywords: Pick<
    IPageCheckKeyword,
    'keyword' | 'visibility' | 'url' | 'rank'
  >[]
): void => {
  const invalid = keywords.filter(
    ({ visibility, url, rank }) =>
      visibility && (!url.trim() || !rank || rank < 1)
  );
  if (invalid.length === 0) return;

  throw new Error(
    `${target} 노출 결과 필수값 누락: ${invalid.length}개 ` +
      `(링크 또는 양수 순위 없음, 예: ${invalid[0].keyword})`
  );
};

export const validateDistributedPageTarget = async (
  target: Extract<PageCheckSheetType, 'pet' | 'suripet'>
): Promise<void> => {
  const keywords = await getPageCheckKeywords(target);
  assertCompletePageExposureResults(target, keywords);
};

export const finalizeDistributedPageTarget = async (
  target: Extract<PageCheckSheetType, 'pet' | 'suripet'>,
  elapsedTime: string
): Promise<void> => {
  const keywords = await getPageCheckKeywords(target);
  assertCompletePageExposureResults(target, keywords);
  const results = keywords
    .filter((keyword) => keyword.visibility)
    .map(toExposureResult);
  const timestamp = getKSTTimestamp();
  const logicMap = new Map(
    keywords.map((keyword) => [keyword.keyword, keyword.isNewLogic ?? false])
  );

  saveToCSV(results, `distributed-${target}_${timestamp}.csv`);
  saveToSheetCSV(
    keywords.map(({ keyword, company }) => ({ keyword, company })),
    results,
    `distributed-${target}_sheet_${timestamp}.csv`,
    logicMap
  );

  const sent = await sendDoorayExposureResult({
    cronType: LABELS[target],
    totalKeywords: keywords.length,
    exposureCount: results.length,
    popularCount: results.filter(({ exposureType }) => exposureType === '인기글').length,
    sblCount: results.filter(({ exposureType }) => exposureType === '스블').length,
    elapsedTime,
    missingKeywords: keywords.filter(({ visibility }) => !visibility).map(({ keyword }) => keyword),
  });
  if (!sent) throw new Error(`${LABELS[target]} Dooray 전송 실패`);
};
