import { Keyword } from '../../database';
import type { SyncRequest } from '../../constants';
import {
  getGoogleSheetAuth,
  getWorksheetByTitle,
  loadKeywordsFromWorksheet,
  openSpreadsheet,
} from '../google-sheets/direct-exposure-sheet';
import { logger } from '../logger';

export interface SheetKeywordSyncResult {
  sheetType: string;
  deleted: number;
  inserted: number;
}

export interface SheetKeywordRow {
  keyword: string;
  company: string;
  isUpdateRequired: boolean;
  isNewLogic: boolean;
}

/**
 * 원본 시트 행을 Keyword 컬렉션에 넣을 문서로 바꾼다. 노출 결과 필드(visibility/url/rank 등)는
 * 이번 실행에서 새로 채울 값이라 기본값으로 비워두고, 크롤러가 채운 뒤 결과 시트로 나간다.
 * I/O와 분리해 테스트할 수 있게 순수 함수로 둠.
 */
export const toKeywordDocuments = (
  rows: readonly SheetKeywordRow[],
  sheetType: string,
  checkedAt: Date,
  fallbackCompany: string
) =>
  rows.map(({ keyword, company, isUpdateRequired, isNewLogic }) => ({
    keyword,
    company: company || fallbackCompany,
    sheetType,
    keywordType: 'basic' as const,
    isUpdateRequired: isUpdateRequired ?? false,
    isNewLogic: isNewLogic ?? false,
    visibility: false,
    lastChecked: checkedAt,
  }));

/**
 * 패키지현황 원본 시트에서 키워드를 직접 읽어 Keyword 컬렉션을 교체한다.
 *
 * 예전에는 외부 시트앱(SHEET_APP_URL)에 POST해서 동기화했는데, 그 서버는 이 레포에 없어서
 * 원격 배포 환경에서는 항상 실패했다. 원본은 읽기 전용으로만 접근하고, 결과 반영은 기존처럼
 * 프로그램 노출체크 시트(write-target-guard가 강제)로만 나간다.
 */
export const syncKeywordsFromSourceSheet = async (
  request: SyncRequest
): Promise<SheetKeywordSyncResult> => {
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(request.sheetId, auth);
  const sheet = getWorksheetByTitle(doc, request.sheetName);
  const rows = await loadKeywordsFromWorksheet(sheet, request.sheetType);

  if (rows.length === 0) {
    throw new Error(
      `${request.sheetName} 원본에서 동기화할 키워드를 찾지 못함`
    );
  }

  const deleteResult = await Keyword.deleteMany({
    sheetType: request.sheetType,
  });
  const insertResult = await Keyword.insertMany(
    toKeywordDocuments(rows, request.sheetType, new Date(), request.sheetName)
  );

  logger.success(
    `  ${request.sheetName}: ${insertResult.length}개 직접 동기화`
  );

  return {
    sheetType: request.sheetType,
    deleted: deleteResult.deletedCount ?? 0,
    inserted: insertResult.length,
  };
};
