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

interface ResultQueueMaps {
  companyScoped: Map<string, ExposureResult[]>;
  unscoped: Map<string, ExposureResult[]>;
}

export type SheetCellValue = string | number;

const getCompanyResultKey = (query: string, company: string): string =>
  `${query}\u0000${company}`;

const addResultToQueue = (
  queues: Map<string, ExposureResult[]>,
  key: string,
  result: ExposureResult
): void => {
  const existingQueue = queues.get(key);
  if (existingQueue) {
    existingQueue.push(result);
    return;
  }
  queues.set(key, [result]);
};

const getResultQueueMaps = (results: ExposureResult[]): ResultQueueMaps => {
  const companyScoped = new Map<string, ExposureResult[]>();
  const unscoped = new Map<string, ExposureResult[]>();

  for (const result of results) {
    const company = String(result.company || '').trim();
    if (company) {
      addResultToQueue(
        companyScoped,
        getCompanyResultKey(result.query, company),
        result
      );
      continue;
    }
    addResultToQueue(unscoped, result.query, result);
  }

  return { companyScoped, unscoped };
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

const buildSheetRow = (
  keywordInfo: KeywordInfo,
  result: ExposureResult | undefined,
  rowNumber: number,
  keywordLogicMap?: Map<string, boolean>
): SheetCellValue[] => {
  if (!result) {
    return [
      keywordInfo.company || '',
      keywordInfo.keyword,
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
    ];
  }

  const isPopular = result.exposureType === '인기글';
  const popularRank = isPopular ? result.position : '';

  return [
    keywordInfo.company || '',
    keywordInfo.keyword,
    result.topicName || result.exposureType,
    result.position,
    'o',
    '',
    popularRank,
    '',
    result.postLink,
    result.postPublishedAt || '',
    formatSheetExposureLogicType(result.isNewLogic),
    rowNumber,
  ];
};

export const buildSheetRows = (
  keywords: KeywordInfo[],
  results: ExposureResult[],
  keywordLogicMap?: Map<string, boolean>
): SheetCellValue[][] => {
  const resultMaps = getResultQueueMaps(results);

  return keywords.map((keywordInfo, index) => {
    const company = String(keywordInfo.company || '').trim();
    const scopedQueue = company
      ? resultMaps.companyScoped.get(
          getCompanyResultKey(keywordInfo.keyword, company)
        )
      : undefined;
    const result =
      scopedQueue?.shift() ??
      resultMaps.unscoped.get(keywordInfo.keyword)?.shift();

    return buildSheetRow(keywordInfo, result, index + 1, keywordLogicMap);
  });
};

const ESCAPED_SHEET_COLUMNS = new Set([0, 1, 2, 9]);

const formatSheetCellForCsv = (
  value: SheetCellValue,
  columnIndex: number
): string => {
  const stringValue = String(value);
  if (stringValue === '') return '';
  return ESCAPED_SHEET_COLUMNS.has(columnIndex)
    ? escapeCsvValue(stringValue)
    : stringValue;
};

export const saveToSheetCSV = (
  keywords: KeywordInfo[],
  results: ExposureResult[],
  filename: string,
  keywordLogicMap?: Map<string, boolean>
): void => {
  const filePath = resolveOutputFilePath(filename);
  const rows = buildSheetRows(keywords, results, keywordLogicMap).map((row) =>
    row.map(formatSheetCellForCsv).join(',')
  );

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
