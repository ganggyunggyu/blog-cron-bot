import * as fs from 'fs';
import * as path from 'path';
import { ExposureResult } from './matcher';
import { logger } from './lib/logger';

interface KeywordInfo {
  keyword: string;
  company: string;
}

export const saveToSheetCSV = (
  keywords: KeywordInfo[],
  results: ExposureResult[],
  filename: string,
  keywordLogicMap?: Map<string, boolean>
): void => {
  const outputDir = path.join(__dirname, '../output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);

  const header = [
    '업체명',
    '키워드',
    '인기주제',
    '순위',
    '노출여부',
    '바이럴 체크',
    '인기글 순위',
    '이미지 매칭',
    '링크',
    '로직',
    '행',
  ].join(',');

  const resultMap = new Map<string, ExposureResult>();
  for (const result of results) {
    resultMap.set(result.query, result);
  }

  const rows = keywords.map((kw, index) => {
    const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const result = resultMap.get(kw.keyword);

    if (result) {
      const isPopular = result.exposureType === '인기글';
      const popularRank = isPopular ? result.position : '';
      const logicType =
        result.isNewLogic === true
          ? 'o'
          : result.isNewLogic === false
            ? ''
            : '';

      return [
        escape(kw.company || ''),
        escape(kw.keyword),
        escape(result.topicName || result.exposureType),
        result.position,
        'o',
        '',
        popularRank,
        '',
        result.postLink,
        logicType,
        index + 1,
      ].join(',');
    } else {
      // 미노출인 경우에도 keywordLogicMap에서 로직 타입 가져오기
      let logicType = '';
      if (keywordLogicMap && keywordLogicMap.has(kw.keyword)) {
        const isNewLogic = keywordLogicMap.get(kw.keyword);
        logicType =
          isNewLogic === true ? '신규' : isNewLogic === false ? '구' : '';
      }

      return [
        escape(kw.company || ''),
        escape(kw.keyword),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        logicType,
        index + 1,
      ].join(',');
    }
  });

  const csvContent = [header, ...rows].join('\n');

  fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

  logger.success(`시트 형식 CSV 저장 완료: ${filePath}`);
};

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
    '로직',
  ].join(',');

  const rows = results.map((result) => {
    const logicType =
      result.isNewLogic === true
        ? '신규'
        : result.isNewLogic === false
          ? '구'
          : '';
    return [
      `"${result.query}"`,
      result.blogId,
      `"${result.blogName}"`,
      `"${result.postTitle.replace(/"/g, '""')}"`,
      result.postLink,
      result.exposureType,
      `"${result.topicName}"`,
      result.position,
      logicType,
    ].join(',');
  });

  const csvContent = [header, ...rows].join('\n');

  fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

  logger.success(`CSV 저장 완료: ${filePath}`);
};
