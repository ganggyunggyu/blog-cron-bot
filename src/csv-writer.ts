import * as fs from 'fs';
import * as path from 'path';
import { ExposureResult } from './matcher';
import { logger } from './lib/logger';

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface KeywordInfo {
  keyword: string;
  company: string;
}

export interface KeywordLogicRow {
  keyword: string;
  postType: string;
  isNewLogic: boolean;
}

export interface CafeExposureCsvRow {
  keyword: string;
  exposureStatus: string;
  rank: string;
  cafeName: string;
  link: string;
}

const OUTPUT_ROOT_DIR = path.join(__dirname, '../output');
const TIMESTAMP_SUFFIX_REGEX =
  /(?:_|-)(\d{4})-(\d{2})-(\d{2})(?:T|-)\d{2}-\d{2}-\d{2}$/;

const getKSTDateParts = (): DateParts => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
};

const parseDatePartsFromFilename = (filename: string): DateParts | null => {
  const baseName = path.basename(filename, path.extname(filename));
  const match = baseName.match(TIMESTAMP_SUFFIX_REGEX);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
};

const getWeekFolderName = ({ year, month, day }: DateParts): string => {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const weekOfMonth = Math.ceil((day + firstDay) / 7);
  return `${year}-${String(month).padStart(2, '0')}월${weekOfMonth}주차`;
};

const getTypeFolderName = (filename: string): string => {
  const baseName = path.basename(filename, path.extname(filename));
  const nameWithoutTimestamp = baseName
    .replace(TIMESTAMP_SUFFIX_REGEX, '')
    .replace(/[_-]+$/, '');

  if (/^test([_-]|$)/.test(nameWithoutTimestamp)) {
    return 'test';
  }

  return nameWithoutTimestamp || 'misc';
};

const resolveOutputFilePath = (filename: string): string => {
  const dateParts = parseDatePartsFromFilename(filename) ?? getKSTDateParts();
  const weekFolderName = getWeekFolderName(dateParts);
  const typeFolderName = getTypeFolderName(filename);
  const outputDir = path.join(OUTPUT_ROOT_DIR, weekFolderName, typeFolderName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return path.join(outputDir, filename);
};

export const saveToSheetCSV = (
  keywords: KeywordInfo[],
  results: ExposureResult[],
  filename: string,
  keywordLogicMap?: Map<string, boolean>
): void => {
  const filePath = resolveOutputFilePath(filename);

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
  const filePath = resolveOutputFilePath(filename);

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

export const saveCafeExposureCSV = (
  rows: CafeExposureCsvRow[],
  filename: string
): string => {
  const filePath = resolveOutputFilePath(filename);
  const escape = (value: string): string =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const header = ['키워드', '노출여부', '순위', '카페명', '링크'].join(',');
  const csvRows = rows.map((row) =>
    [
      escape(row.keyword),
      escape(row.exposureStatus),
      escape(row.rank),
      escape(row.cafeName),
      escape(row.link),
    ].join(',')
  );

  const csvContent = [header, ...csvRows].join('\n');

  fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

  logger.success(`카페 노출체크 CSV 저장 완료: ${filePath}`);

  return filePath;
};

export const saveCafeExposureSheetCSV = (
  rows: CafeExposureCsvRow[],
  filename: string
): string => {
  const filePath = resolveOutputFilePath(filename);
  const escape = (value: string): string =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const header = ['키워드', '노출여부', '순위', '카페명', '링크', '행'].join(',');
  const csvRows = rows.map((row, index) =>
    [
      escape(row.keyword),
      row.exposureStatus === '노출' ? 'o' : '',
      escape(row.rank),
      escape(row.cafeName),
      escape(row.link),
      index + 1,
    ].join(',')
  );

  const csvContent = [header, ...csvRows].join('\n');

  fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

  logger.success(`카페 노출체크 시트 CSV 저장 완료: ${filePath}`);

  return filePath;
};

export const saveKeywordLogicCSV = (
  rows: KeywordLogicRow[],
  filename: string
): void => {
  const filePath = resolveOutputFilePath(filename);

  const header = ['키워드', '글타입', '신규로직'].join(',');

  const escape = (value: string) => `"${(value || '').replace(/"/g, '""')}"`;

  const formatRow = (row: KeywordLogicRow) => {
    const logicType = row.isNewLogic ? 'o' : 'x';
    return [escape(row.keyword), escape(row.postType), logicType].join(',');
  };

  const csvRows = rows.map(formatRow);
  const csvContent = [header, ...csvRows].join('\n');

  fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

  logger.success(`키워드 로직 CSV 저장 완료: ${filePath}`);
};
