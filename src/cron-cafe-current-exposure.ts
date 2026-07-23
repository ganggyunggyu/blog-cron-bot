import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import { TEST_CONFIG } from './constants';
import { runCustomExposureChecks } from './lib/custom-cafe-blog-check/checker';
import { CAFE_FALLBACK_TARGETS } from './lib/custom-cafe-blog-check/sheet';
import { resolveOutputFilePath } from './lib/csv-output/output-path';
import { sendDoorayExposureResult } from './lib/dooray';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  openSpreadsheet,
} from './lib/google-sheets/direct-exposure-sheet';
import { assertWritableSheetId } from './lib/google-sheets/write-target-guard';
import { logger } from './lib/logger';
import { formatDuration } from './lib/utils';
import { getKSTTimestamp } from './utils';

dotenv.config();

const TARGET_TAB = '카페노출체크';
const text = (value: unknown): string => String(value ?? '').trim();
const getConcurrency = (): number => {
  const value = Number(process.env.CAFE_CHECK_CONCURRENCY);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 8;
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  assertWritableSheetId(TEST_CONFIG.SHEET_ID, TARGET_TAB);
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, getGoogleSheetAuth());
  const sheet = getWorksheetByTitle(doc, TARGET_TAB);
  await sheet.loadCells(`A1:F${sheet.rowCount}`);

  const rows = Array.from({ length: sheet.rowCount - 1 }, (_, offset) => {
    const rowIndex = offset + 1;
    return {
      rowIndex,
      keyword: text(sheet.getCell(rowIndex, 0).value),
      cafeAccount: text(sheet.getCell(rowIndex, 5).value),
    };
  }).filter(({ keyword }) => keyword.length > 0);
  const keywords = Array.from(new Set(rows.map(({ keyword }) => keyword)));
  logger.info(
    `${TARGET_TAB}: ${rows.length}행 / 고유 키워드 ${keywords.length}개 / ` +
      `카페 ${CAFE_FALLBACK_TARGETS.length}개`
  );

  const results = await runCustomExposureChecks(
    keywords,
    CAFE_FALLBACK_TARGETS,
    getConcurrency()
  );
  rows.forEach(({ rowIndex, keyword }) => {
    const result = results.get(keyword);
    if (!result) throw new Error(`${keyword} 결과 누락`);
    const values = [
      result.exposureStatus === '노출'
        ? 'o'
        : result.exposureStatus === '확인실패'
          ? '확인실패'
          : '',
      result.rank,
      result.name,
      result.links,
    ];
    values.forEach((value, columnOffset) => {
      sheet.getCell(rowIndex, columnOffset + 1).value = value;
    });
  });
  await sheet.saveUpdatedCells();

  sheet.resetLocalCache(true);
  await sheet.loadCells(`A1:F${sheet.rowCount}`);
  rows.forEach(({ rowIndex, keyword, cafeAccount }) => {
    const result = results.get(keyword)!;
    const expected = [
      keyword,
      result.exposureStatus === '노출'
        ? 'o'
        : result.exposureStatus === '확인실패'
          ? '확인실패'
          : '',
      result.rank,
      result.name,
      result.links,
      cafeAccount,
    ];
    expected.forEach((value, columnIndex) => {
      if (text(sheet.getCell(rowIndex, columnIndex).value) !== text(value)) {
        throw new Error(
          `${TARGET_TAB} 재조회 불일치: ${rowIndex + 1}행 ${columnIndex + 1}열`
        );
      }
    });
  });

  const summary = {
    rows: rows.length,
    uniqueKeywords: keywords.length,
    exposed: rows.filter(
      ({ keyword }) => results.get(keyword)?.exposureStatus === '노출'
    ).length,
    failed: rows.filter(
      ({ keyword }) => results.get(keyword)?.exposureStatus === '확인실패'
    ).length,
  };
  const outputPath = resolveOutputFilePath(
    `cafe_current_${getKSTTimestamp()}.json`
  );
  fs.writeFileSync(outputPath, `${JSON.stringify({ summary }, null, 2)}\n`);
  await sendDoorayExposureResult({
    cronType: TARGET_TAB,
    totalKeywords: summary.rows,
    exposureCount: summary.exposed,
    popularCount: 0,
    sblCount: 0,
    elapsedTime: formatDuration(Date.now() - startedAt),
    missingKeywords: rows
      .filter(({ keyword }) => results.get(keyword)?.exposureStatus !== '노출')
      .map(({ keyword }) => keyword),
  });
  logger.success(`${TARGET_TAB} 반영 및 재조회 완료: ${JSON.stringify(summary)}`);
};

main().catch((error) => {
  logger.error(`카페 현재 시트 노출체크 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
