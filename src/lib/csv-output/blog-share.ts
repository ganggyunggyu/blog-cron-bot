import { logger } from '../logger';
import { escapeCsvValue, writeBomCsvFile } from './format';
import { resolveOutputFilePath } from './output-path';
import { BlogShareDetailCsvRow, BlogShareSummaryCsvRow } from './types';

const BLOG_SHARE_SUMMARY_HEADER = [
  '순위',
  '블로그ID',
  '블로그명',
  '점유키워드수',
  '총노출수',
  '최고순위',
  '점유키워드',
].join(',');

const BLOG_SHARE_DETAIL_HEADER = [
  '키워드',
  '블로그ID',
  '블로그명',
  '게시글제목',
  '게시글링크',
  '노출영역',
  '주제명',
  '순위',
  '신로직',
].join(',');

export const saveBlogShareSummaryCSV = (
  rows: BlogShareSummaryCsvRow[],
  filename: string
): string => {
  const filePath = resolveOutputFilePath(filename);
  const csvRows = rows.map((row) =>
    [
      row.rank,
      escapeCsvValue(row.blogId),
      escapeCsvValue(row.blogName),
      row.keywordCount,
      row.exposureCount,
      row.bestPosition,
      escapeCsvValue(row.keywords.join(' / ')),
    ].join(',')
  );

  writeBomCsvFile(filePath, [BLOG_SHARE_SUMMARY_HEADER, ...csvRows]);
  logger.success(`블로그 점유 요약 CSV 저장 완료: ${filePath}`);
  return filePath;
};

export const saveBlogShareDetailCSV = (
  rows: BlogShareDetailCsvRow[],
  filename: string
): string => {
  const filePath = resolveOutputFilePath(filename);
  const csvRows = rows.map((row) =>
    [
      escapeCsvValue(row.keyword),
      escapeCsvValue(row.blogId),
      escapeCsvValue(row.blogName),
      escapeCsvValue(row.postTitle),
      row.postLink,
      escapeCsvValue(row.exposureType),
      escapeCsvValue(row.topicName),
      row.position,
      row.isNewLogic ? 'o' : '',
    ].join(',')
  );

  writeBomCsvFile(filePath, [BLOG_SHARE_DETAIL_HEADER, ...csvRows]);
  logger.success(`블로그 점유 상세 CSV 저장 완료: ${filePath}`);
  return filePath;
};
