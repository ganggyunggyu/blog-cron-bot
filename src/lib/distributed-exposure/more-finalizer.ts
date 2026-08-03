import * as fs from 'node:fs';
import * as path from 'node:path';
import { TEST_CONFIG } from '../../constants';
import { sendDoorayExposureResult } from '../dooray';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  openSpreadsheet,
} from '../google-sheets/direct-exposure-sheet';

const OUTPUT_HEADERS = [
  '키워드',
  '블로그아이디',
  '순위',
  '링크',
  '작성일자',
  '상위글1작성일자',
  '상위글2작성일자',
  '상위글3작성일자',
  '상태',
];

const TARGETS = {
  package: { label: '패키지', outputTitle: '패키지_더보기' },
  general: { label: '일반건', outputTitle: '일반건_더보기' },
  dogmaru: { label: '도그마루', outputTitle: '도그마루_더보기' },
  root: { label: '루트', outputTitle: '0611' },
} as const;

type MoreTarget = keyof typeof TARGETS;

const csvCell = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const outputFileName = (target: MoreTarget): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve('output', 'old-logic-more', `${target}_${stamp}.csv`);
};

export interface MoreFinalizeResult {
  totalKeywords: number;
  exposedKeywords: number;
  resultRows: number;
  csvPath: string;
}

export const finalizeDistributedOldLogicMore = async (
  target: MoreTarget,
  elapsedTime: string
): Promise<MoreFinalizeResult> => {
  const definition = TARGETS[target];
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, getGoogleSheetAuth());
  const sheet = getWorksheetByTitle(doc, definition.outputTitle);
  await sheet.loadCells(`A1:I${sheet.rowCount}`);
  const rows = Array.from({ length: Math.max(sheet.rowCount - 1, 0) }, (_, index) =>
    OUTPUT_HEADERS.map((_, columnIndex) =>
      String(sheet.getCell(index + 1, columnIndex).value ?? '').trim()
    )
  ).filter(([keyword]) => keyword.length > 0);
  const totalKeywords = new Set(rows.map(([keyword]) => keyword)).size;
  const exposedKeywords = new Set(
    rows.filter((row) => row[8] === '노출').map(([keyword]) => keyword)
  ).size;
  const csvPath = outputFileName(target);
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  fs.writeFileSync(
    csvPath,
    [OUTPUT_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n',
    'utf8'
  );
  const sent = await sendDoorayExposureResult({
    cronType: `${definition.label} 더보기`,
    totalKeywords,
    exposureCount: exposedKeywords,
    popularCount: 0,
    sblCount: 0,
    elapsedTime,
  });
  if (!sent) throw new Error(`${definition.label} 더보기 Dooray 전송 실패`);

  return { totalKeywords, exposedKeywords, resultRows: rows.length, csvPath };
};
