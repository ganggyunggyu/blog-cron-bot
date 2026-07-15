import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { TEST_CONFIG } from '../../constants/api';
import { logger } from '../logger';
import {
  DirectSheetUpdate,
  buildKeywordQueueMap,
  getGoogleSheetAuth,
  getWorksheetByTitle,
  loadKeywordsFromWorksheet,
  openSpreadsheet,
  writeResultsToWorksheet,
} from './direct-exposure-sheet';

type SuripetSheetRow = Record<string, string>;

export interface SuripetPageCheckKeywordInput {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  keywordType: 'pet';
  matchedTitle: string;
  rank: number;
  isUpdateRequired: boolean;
  isNewLogic: boolean;
  foundPage: number;
}

const SURIPET_SHEET_NAME = '서리펫';

const getAuth = (): JWT => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL 또는 GOOGLE_PRIVATE_KEY 환경변수가 없음'
    );
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
};

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

const parseBooleanCell = (value: unknown): boolean => {
  const normalized = normalizeCell(value).toLowerCase();
  return ['o', '1', 'true', 'y', 'yes', '신규'].includes(normalized);
};

const parseNumberCell = (value: unknown): number => {
  const raw = normalizeCell(value);
  if (!raw) return 0;

  const parsed = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseFoundPage = (popularTopic: string): number => {
  const match = popularTopic.match(/검색결과\s*(\d+)페이지/);
  if (!match) return 0;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const loadSuripetKeywordsFromSheet = async (): Promise<
  SuripetPageCheckKeywordInput[]
> => {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(TEST_CONFIG.SHEET_ID, auth);
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle[SURIPET_SHEET_NAME];
  if (!sheet) {
    throw new Error(`"${SURIPET_SHEET_NAME}" 시트를 찾을 수 없음`);
  }

  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();

  const keywords = rows
    .map((row) => row.toObject() as SuripetSheetRow)
    .map((row) => {
      const keyword = normalizeCell(row['키워드']);
      const popularTopic = normalizeCell(row['인기주제']);

      return {
        company: '서리펫',
        keyword,
        visibility: parseBooleanCell(row['노출여부']),
        popularTopic,
        url: normalizeCell(row['링크']),
        keywordType: 'pet' as const,
        matchedTitle: normalizeCell(row['이미지 매칭']),
        rank: parseNumberCell(row['순위']),
        isUpdateRequired: parseBooleanCell(row['바이럴 체크']),
        isNewLogic: parseBooleanCell(row['로직']),
        foundPage: parseFoundPage(popularTopic),
      };
    })
    .filter(({ keyword }) => keyword.length > 0);

  logger.success(
    `Google Sheets 서리펫 동기화 원본 로드 완료: ${keywords.length}개`
  );

  return keywords;
};

export interface SuripetResultInput {
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  postPublishedAt?: string;
  keywordType: 'restaurant' | 'pet' | 'basic';
  matchedTitle?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
}

/**
 * PAGE_CHECK_API(외부 서버)를 거치지 않고, 이미 검증된 direct-write 경로로
 * "서리펫" 탭에 결과를 직접 반영함. 키워드 텍스트로 매칭하므로 시트 행 순서가
 * DB 조회 순서와 달라도 엉뚱한 행에 쓰이지 않음.
 */
export const writeSuripetResultsToSheet = async (
  results: SuripetResultInput[]
): Promise<void> => {
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(TEST_CONFIG.SHEET_ID, auth);
  const sheet = getWorksheetByTitle(doc, SURIPET_SHEET_NAME);
  const sheetKeywords = await loadKeywordsFromWorksheet(sheet, 'suripet');
  const queueMap = buildKeywordQueueMap(sheetKeywords);
  const updates = new Map<string, DirectSheetUpdate>();
  let mappedCount = 0;
  let unmatchedCount = 0;

  results.forEach((result) => {
    const queue = queueMap.get(normalizeCell(result.keyword));
    const matched = queue?.shift();

    if (!matched) {
      unmatchedCount += 1;
      return;
    }

    updates.set(matched._id, {
      visibility: result.visibility,
      popularTopic: result.popularTopic,
      url: result.url,
      postPublishedAt: result.postPublishedAt,
      keywordType: result.keywordType,
      matchedTitle: result.matchedTitle,
      rank: result.rank,
      rankWithCafe: result.rankWithCafe,
      isUpdateRequired: result.isUpdateRequired,
      isNewLogic: result.isNewLogic,
      foundPage: result.foundPage,
    });
    mappedCount += 1;
  });

  await writeResultsToWorksheet(sheet, sheetKeywords, updates);
  logger.success(
    `Google Sheets 서리펫 직접 반영 완료: ${mappedCount}/${sheetKeywords.length}행 (미매칭 ${unmatchedCount})`
  );
};
