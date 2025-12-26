import * as fs from 'fs';
import * as path from 'path';
import { ExposureResult } from './matcher';
import { logger } from './lib/logger';

export const saveToCSV = (
  results: ExposureResult[],
  filename: string
): void => {
  const outputDir = path.join(__dirname, '../output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);

  const header = [
    '검색어',
    '블로그ID',
    '블로그명',
    '게시글제목',
    '게시글링크',
    '인기주제',
    '스블주제명',
    '순위',
  ].join(',');

  const rows = results.map((result) => {
    return [
      `"${result.query}"`,
      result.blogId,
      `"${result.blogName}"`,
      `"${result.postTitle.replace(/"/g, '""')}"`,
      result.postLink,
      result.exposureType,
      `"${result.topicName}"`,
      result.position,
    ].join(',');
  });

  const csvContent = [header, ...rows].join('\n');

  fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

  logger.success(`CSV 저장 완료: ${filePath}`);
};
