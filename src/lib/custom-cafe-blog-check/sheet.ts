import { CAFE_SOURCE_CONFIG, TEST_CONFIG } from '../../constants';
import type { CafeTarget } from '../cafe-exposure-check';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  openSpreadsheet,
} from '../google-sheets/direct-exposure-sheet';
import { assertWritableSheetId } from '../google-sheets/write-target-guard';
import type {
  CustomExposureCheckedResult,
  CustomExposureInputRow,
} from './types';

const text = (value: unknown): string => String(value ?? '').trim();
const sourceIdFromUrl = (url: string): string =>
  url.match(/cafe\.naver\.com\/([^/?#]+)/i)?.[1]?.trim() ?? '';

export const CAFE_FALLBACK_TARGETS: CafeTarget[] = [
  { name: '일상 소통마당', ids: ['talkmadang702'] },
  { name: '가중건다', ids: ['healthhhh'] },
  { name: '운연정', ids: ['driveee'] },
  { name: '육아 돌봄수첩', ids: ['ahffkdlek12'] },
  { name: '맛집 동네밥상', ids: ['localtable702'] },
  { name: '맛집 메뉴수첩', ids: ['menunote702'] },
  { name: '맛집 식탁모임', ids: ['tableclub702'] },
  { name: '맛집 메뉴토크', ids: ['mealtalkdht'] },
  { name: '애견 반려정보', ids: ['petinfo183'] },
  { name: '애견 산책이야기', ids: ['dogwalk2m4'] },
  { name: '건강 생활수첩', ids: ['carelog702'] },
  { name: '건강 습관노트', ids: ['habitnote702'] },
  { name: '생활 정보마당', ids: ['infomadang702'] },
];

export const buildCafeExposureTargetsFromValues = (
  values: readonly unknown[][]
): CafeTarget[] => {
  const targets = new Map<string, CafeTarget>();
  values.slice(1).forEach((row) => {
    const displayName = text(row[14]);
    [row[6], row[8]].forEach((value) => {
      const sourceId = sourceIdFromUrl(text(value));
      if (!sourceId || targets.has(sourceId)) return;
      targets.set(sourceId, {
        name: displayName || sourceId,
        ids: [sourceId],
      });
    });
  });
  return Array.from(targets.values());
};

export const loadCustomExposureRows = async (
  targetTab: string
): Promise<CustomExposureInputRow[]> => {
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, getGoogleSheetAuth());
  const sheet = getWorksheetByTitle(doc, targetTab);
  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: 2,
  });

  return Array.from({ length: sheet.rowCount - 1 }, (_, offset) => {
    const rowIndex = offset + 1;
    return {
      sheetRow: rowIndex + 1,
      company: text(sheet.getCell(rowIndex, 0).value),
      keyword: text(sheet.getCell(rowIndex, 1).value),
    };
  }).filter(({ keyword }) => keyword.length > 0);
};

export const loadCafeExposureTargets = async (): Promise<CafeTarget[]> => {
  const doc = await openSpreadsheet(CAFE_SOURCE_CONFIG.SHEET_ID, getGoogleSheetAuth());
  const sheet = getWorksheetByTitle(doc, CAFE_SOURCE_CONFIG.SHEET_NAME);
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 6,
    endColumnIndex: 15,
  });
  const values = Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    Array.from({ length: 15 }, (_, columnIndex) =>
      columnIndex < 6 ? '' : sheet.getCell(rowIndex, columnIndex).value
    )
  );
  const sheetTargets = buildCafeExposureTargetsFromValues(values);
  return mergeCafeTargets(sheetTargets, CAFE_FALLBACK_TARGETS);
};

/**
 * 시트에서 읽은 카페와 기본 보유 카페 목록을 카페 id 기준으로 합침. 시트에 카페가 있어도
 * 기본 목록(위대한 그룹 등)을 통째로 버리지 않도록 union으로 처리하고, 같은 id는 시트 쪽
 * 이름을 우선한다.
 */
export const mergeCafeTargets = (
  sheetTargets: readonly CafeTarget[],
  fallbackTargets: readonly CafeTarget[]
): CafeTarget[] => {
  const byId = new Map<string, CafeTarget>();
  [...sheetTargets, ...fallbackTargets].forEach(({ name, ids }) => {
    (ids ?? []).forEach((id) => {
      const trimmed = id.trim();
      if (!trimmed || byId.has(trimmed)) return;
      byId.set(trimmed, { name, ids: [trimmed] });
    });
  });
  return Array.from(byId.values());
};

export const writeCustomExposureResults = async (
  targetTab: string,
  rows: CustomExposureInputRow[],
  results: Map<string, CustomExposureCheckedResult>
): Promise<void> => {
  assertWritableSheetId(TEST_CONFIG.SHEET_ID, targetTab);
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, getGoogleSheetAuth());
  const sheet = getWorksheetByTitle(doc, targetTab);
  const lastRow = Math.max(...rows.map(({ sheetRow }) => sheetRow));
  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: lastRow,
    startColumnIndex: 2,
    endColumnIndex: 6,
  });
  rows.forEach(({ sheetRow, keyword }) => {
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
      sheet.getCell(sheetRow - 1, columnOffset + 2).value = value;
    });
  });
  await sheet.saveUpdatedCells();

  sheet.resetLocalCache(true);
  await sheet.loadCells(`A1:F${lastRow}`);
  rows.forEach(({ sheetRow, company, keyword }) => {
    const result = results.get(keyword)!;
    const expected = [
      company,
      keyword,
      result.exposureStatus === '노출'
        ? 'o'
        : result.exposureStatus === '확인실패'
          ? '확인실패'
          : '',
      result.rank,
      result.name,
      result.links,
    ];
    expected.forEach((value, columnIndex) => {
      if (text(sheet.getCell(sheetRow - 1, columnIndex).value) !== text(value)) {
        throw new Error(
          `${targetTab} 재조회 불일치: ${sheetRow}행 ${columnIndex + 1}열`
        );
      }
    });
  });
};
