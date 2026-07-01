import * as fs from 'fs';
import * as path from 'path';

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const OUTPUT_ROOT_DIR = path.join(__dirname, '../../../output');
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
  if (!match) return null;

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

export const resolveOutputFilePath = (filename: string): string => {
  const dateParts = parseDatePartsFromFilename(filename) ?? getKSTDateParts();
  const weekFolderName = getWeekFolderName(dateParts);
  const typeFolderName = getTypeFolderName(filename);
  const outputDir = path.join(OUTPUT_ROOT_DIR, weekFolderName, typeFolderName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return path.join(outputDir, filename);
};
