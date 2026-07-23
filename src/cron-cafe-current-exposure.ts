import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import { TEST_CONFIG } from './constants';
import { runCustomExposureChecks } from './lib/custom-cafe-blog-check/checker';
import { CAFE_FALLBACK_TARGETS } from './lib/custom-cafe-blog-check/sheet';
import { buildCafeSourceMirrorRows } from './lib/cafe-source-mirror';
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
const SOURCE_TAB = '카페원본_자동';
const TARGET_HEADERS = ['키워드', '노출여부', '순위', '카페블로그명', '링크', '카페계정'];
const text = (value: unknown): string => String(value ?? '').trim();
const getConcurrency = (): number => {
  const value = Number(process.env.CAFE_CHECK_CONCURRENCY);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 8;
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  assertWritableSheetId(TEST_CONFIG.SHEET_ID, TARGET_TAB);
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, getGoogleSheetAuth());
  const sourceSheet = getWorksheetByTitle(doc, SOURCE_TAB);
  const sheet = getWorksheetByTitle(doc, TARGET_TAB);

  await sourceSheet.loadCells(`A1:B${sourceSheet.rowCount}`);
  await sheet.loadCells(`A1:F${sheet.rowCount}`);

  const sourceValues = Array.from({ length: sourceSheet.rowCount }, (_, rowIndex) =>
    Array.from({ length: 2 }, (_, columnIndex) =>
      sourceSheet.getCell(rowIndex, columnIndex).value
    )
  );
  const targetValues = Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    Array.from({ length: 6 }, (_, columnIndex) =>
      sheet.getCell(rowIndex, columnIndex).value
    )
  );
  const sourceRows = buildCafeSourceMirrorRows(sourceValues, targetValues);
  await sheet.clear(`A1:F${sheet.rowCount}`);
  await sheet.loadCells(`A1:F${Math.max(sourceRows.length + 1, 1)}`);
  TARGET_HEADERS.forEach((header, columnIndex) => {
    sheet.getCell(0, columnIndex).value = header;
  });
  sourceRows.forEach(({ rawKeyword, cafeAccount }, index) => {
    sheet.getCell(index + 1, 0).value = rawKeyword;
    sheet.getCell(index + 1, 5).value = cafeAccount;
  });
  await sheet.saveUpdatedCells();

  sheet.resetLocalCache(true);
  await sheet.loadCells(`A1:F${Math.max(sourceRows.length + 1, 1)}`);

  const rows = sourceRows.map(({ keyword, cafeAccount }, offset) => {
    const rowIndex = offset + 1;
    return {
      rowIndex,
      keyword,
      cafeAccount,
    };
  });
  const checkRows = rows.filter(({ keyword }) => keyword.length > 0);
  const keywords = Array.from(new Set(checkRows.map(({ keyword }) => keyword)));
  logger.info(
    `${SOURCE_TAB} → ${TARGET_TAB}: 원본 ${rows.length}행 / 검색 ${checkRows.length}행 / ` +
      `고유 키워드 ${keywords.length}개 / ` +
      `카페 ${CAFE_FALLBACK_TARGETS.length}개`
  );

  const results = await runCustomExposureChecks(
    keywords,
    CAFE_FALLBACK_TARGETS,
    getConcurrency()
  );
  checkRows.forEach(({ rowIndex, keyword }) => {
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
  rows.forEach(({ rowIndex, keyword, cafeAccount }, index) => {
    const result = keyword ? results.get(keyword) : undefined;
    const expected = [
      sourceRows[index].rawKeyword,
      result?.exposureStatus === '노출'
        ? 'o'
        : result?.exposureStatus === '확인실패'
          ? '확인실패'
          : '',
      result?.rank ?? '',
      result?.name ?? '',
      result?.links ?? '',
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
    checkedRows: checkRows.length,
    uniqueKeywords: keywords.length,
    exposed: checkRows.filter(
      ({ keyword }) => results.get(keyword)?.exposureStatus === '노출'
    ).length,
    failed: checkRows.filter(
      ({ keyword }) => results.get(keyword)?.exposureStatus === '확인실패'
    ).length,
  };
  const outputPath = resolveOutputFilePath(
    `cafe_current_${getKSTTimestamp()}.json`
  );
  fs.writeFileSync(outputPath, `${JSON.stringify({ summary }, null, 2)}\n`);
  if (process.env.SKIP_DOORAY !== 'true') {
    await sendDoorayExposureResult({
      cronType: TARGET_TAB,
      totalKeywords: summary.checkedRows,
      exposureCount: summary.exposed,
      popularCount: 0,
      sblCount: 0,
      elapsedTime: formatDuration(Date.now() - startedAt),
      missingKeywords: checkRows
        .filter(({ keyword }) => results.get(keyword)?.exposureStatus !== '노출')
        .map(({ keyword }) => keyword),
    });
  }
  logger.success(`${TARGET_TAB} 반영 및 재조회 완료: ${JSON.stringify(summary)}`);
};

main().catch((error) => {
  logger.error(`카페 현재 시트 노출체크 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
