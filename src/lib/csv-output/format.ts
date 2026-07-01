import * as fs from 'fs';

export const escapeCsvValue = (value: string): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

export const writeBomCsvFile = (filePath: string, lines: string[]): void => {
  fs.writeFileSync(filePath, `\uFEFF${lines.join('\n')}`, 'utf8');
};
