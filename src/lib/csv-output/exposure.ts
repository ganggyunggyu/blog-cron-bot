import { ExposureResult } from '../../matcher';
import { logger } from '../logger';
import { escapeCsvValue, writeBomCsvFile } from './format';
import { resolveOutputFilePath } from './output-path';
import { KeywordInfo } from './types';

const EXPOSURE_HEADER = [
  '검색어',
  '블로그ID',
  '블로그명',
  '게시글제목',
  '게시글링크',
  '발행일',
  '인기주제',
  '스블주제명',
  '순위',
  '로직',
].join(',');

const SHEET_HEADER = [
  '업체명',
  '키워드',
  '인기주제',
  '순위',
  '노출여부',
  '바이럴 체크',
  '인기글 순위',
  '이미지 매칭',
  '링크',
  '발행일',
  '로직',
  '행',
].join(',');

const getResultQueueMap = (
  results: ExposureResult[]
): Map<string, ExposureResult[]> => {
  const resultMap = new Map<string, ExposureResult[]>();
  for (const result of results) {
    const existingQueue = resultMap.get(result.query);
    if (existingQueue) {
      existingQueue.push(result);
      continue;
    }
    resultMap.set(result.query, [result]);
  }
  return resultMap;
};

const formatExposureLogicType = (isNewLogic: boolean | undefined): string => {
  if (isNewLogic === true) return '신규';
  if (isNewLogic === false) return '구';
  return '';
};

const formatSheetExposureLogicType = (
  isNewLogic: boolean | undefined
): string => (isNewLogic === true ? 'o' : '');

const formatUnexposedLogicType = (
  keyword: string,
  keywordLogicMap?: Map<string, boolean>
): string => {
  if (!keywordLogicMap?.has(keyword)) return '';
  const isNewLogic = keywordLogicMap.get(keyword);
  if (isNewLogic === true) return '신규';
  if (isNewLogic === false) return '구';
  return '';
};

const formatSheetRow = (
  keywordInfo: KeywordInfo,
  result: ExposureResult | undefined,
  rowNumber: number,
  keywordLogicMap?: Map<string, boolean>
): string => {
  if (!result) {
    return [
      escapeCsvValue(keywordInfo.company || ''),
      escapeCsvValue(keywordInfo.keyword),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      formatUnexposedLogicType(keywordInfo.keyword, keywordLogicMap),
      rowNumber,
    ].join(',');
  }

  const isPopular = result.exposureType === '인기글';
  const popularRank = isPopular ? result.position : '';

  return [
    escapeCsvValue(keywordInfo.company || ''),
    escapeCsvValue(keywordInfo.keyword),
    escapeCsvValue(result.topicName || result.exposureType),
    result.position,
    'o',
    '',
    popularRank,
    '',
    result.postLink,
    escapeCsvValue(result.postPublishedAt || ''),
    formatSheetExposureLogicType(result.isNewLogic),
    rowNumber,
  ].join(',');
};

export const saveToSheetCSV = (
  keywords: KeywordInfo[],
  results: ExposureResult[],
  filename: string,
  keywordLogicMap?: Map<string, boolean>
): void => {
  const filePath = resolveOutputFilePath(filename);
  const resultMap = getResultQueueMap(results);
  const rows = keywords.map((keywordInfo, index) => {
    const resultQueue = resultMap.get(keywordInfo.keyword);
    const result = resultQueue?.shift();
    return formatSheetRow(keywordInfo, result, index + 1, keywordLogicMap);
  });

  writeBomCsvFile(filePath, [SHEET_HEADER, ...rows]);
  logger.success(`시트 형식 CSV 저장 완료: ${filePath}`);
};

export const saveToCSV = (
  results: ExposureResult[],
  filename: string
): void => {
  const filePath = resolveOutputFilePath(filename);
  const rows = results.map((result) =>
    [
      escapeCsvValue(result.query),
      result.blogId,
      escapeCsvValue(result.blogName),
      escapeCsvValue(result.postTitle),
      result.postLink,
      escapeCsvValue(result.postPublishedAt || ''),
      result.exposureType,
      escapeCsvValue(result.topicName),
      result.position,
      formatExposureLogicType(result.isNewLogic),
    ].join(',')
  );

  writeBomCsvFile(filePath, [EXPOSURE_HEADER, ...rows]);
  logger.success(`CSV 저장 완료: ${filePath}`);
};
