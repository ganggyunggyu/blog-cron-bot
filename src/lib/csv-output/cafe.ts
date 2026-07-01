import { logger } from '../logger';
import { escapeCsvValue, writeBomCsvFile } from './format';
import { resolveOutputFilePath } from './output-path';
import { CafeExposureCsvRow } from './types';

const CAFE_HEADER = [
  '키워드',
  '노출여부',
  '순위',
  '카페명',
  '조회수',
  '작성일',
  '링크',
].join(',');

const CAFE_SHEET_HEADER = `${CAFE_HEADER},행`;

export const saveCafeExposureCSV = (
  rows: CafeExposureCsvRow[],
  filename: string
): string => {
  const filePath = resolveOutputFilePath(filename);
  const csvRows = rows.map((row) =>
    [
      escapeCsvValue(row.keyword),
      escapeCsvValue(row.exposureStatus),
      escapeCsvValue(row.rank),
      escapeCsvValue(row.cafeName),
      escapeCsvValue(row.viewCount || ''),
      escapeCsvValue(row.writeDate || ''),
      escapeCsvValue(row.link),
    ].join(',')
  );

  writeBomCsvFile(filePath, [CAFE_HEADER, ...csvRows]);
  logger.success(`카페 노출체크 CSV 저장 완료: ${filePath}`);
  return filePath;
};

export const saveCafeExposureSheetCSV = (
  rows: CafeExposureCsvRow[],
  filename: string
): string => {
  const filePath = resolveOutputFilePath(filename);
  const csvRows = rows.map((row, index) =>
    [
      escapeCsvValue(row.keyword),
      row.exposureStatus === '노출' ? 'o' : '',
      escapeCsvValue(row.rank),
      escapeCsvValue(row.cafeName),
      escapeCsvValue(row.viewCount || ''),
      escapeCsvValue(row.writeDate || ''),
      escapeCsvValue(row.link),
      index + 1,
    ].join(',')
  );

  writeBomCsvFile(filePath, [CAFE_SHEET_HEADER, ...csvRows]);
  logger.success(`카페 노출체크 시트 CSV 저장 완료: ${filePath}`);
  return filePath;
};
