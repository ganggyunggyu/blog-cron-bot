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

export const finalizeDistributedPageTarget = async (
  target: Extract<PageCheckSheetType, 'pet' | 'suripet'>,
  elapsedTime: string
): Promise<void> => {
  const keywords = await getPageCheckKeywords(target);
  const results = keywords.filter((keyword) => keyword.visibility).map(toExposureResult);
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
