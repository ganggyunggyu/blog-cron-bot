import { logger } from '../logger';
import { escapeCsvValue, writeBomCsvFile } from './format';
import { resolveOutputFilePath } from './output-path';
import { KeywordLogicRow } from './types';

const KEYWORD_LOGIC_HEADER = ['키워드', '글타입', '신규로직'].join(',');

export const saveKeywordLogicCSV = (
  rows: KeywordLogicRow[],
  filename: string
): void => {
  const filePath = resolveOutputFilePath(filename);
  const csvRows = rows.map((row) =>
    [
      escapeCsvValue(row.keyword),
      escapeCsvValue(row.postType),
      row.isNewLogic ? 'o' : 'x',
    ].join(',')
  );

  writeBomCsvFile(filePath, [KEYWORD_LOGIC_HEADER, ...csvRows]);
  logger.success(`키워드 로직 CSV 저장 완료: ${filePath}`);
};
