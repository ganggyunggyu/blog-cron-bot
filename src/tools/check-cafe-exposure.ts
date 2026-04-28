import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { crawlWithRetry, crawlWithRetryWithoutCookie, randomDelay } from '../crawler';
import { saveCafeExposureCSV, saveCafeExposureSheetCSV } from '../csv-writer';
import {
  buildCafeExposureRow,
  CafeExposureRow,
  CafeTarget,
  matchCafeTargets,
  extractCafeItems,
} from '../lib/cafe-exposure-check';
import { fetchCafeArticleInfo } from '../lib/cafe-exposure-check/fetch-view-count';
import { exportCafeExposureToSheet, appendCafeExposureToSheet } from '../lib/google-sheets';
import { logger } from '../lib/logger';
import { getKSTTimestamp } from '../utils';

dotenv.config();

const HANRYEODAMWON_CAFE_SHEET_ID =
  '1gyipTIEogC9Qopj8w3ggBmD0k5KvAw6yNdIMXQDnwms';
const HANRYEODAMWON_CAFE_SHEET_NAME = '카페키워드';
const HANRYEODAMWON_CAFE_SHEET_GID = 1923976827;

interface KeywordLoadResult {
  rawCount: number;
  duplicateCount: number;
  keywords: string[];
  sourceLabel: string;
}

interface CafeTargetStat {
  name: string;
  matchedByNameCount: number;
  matchedByIdCount: number;
  sourceIds: Set<string>;
  actualNames: Set<string>;
}

const DEFAULT_INPUT_FILE = path.join(
  process.cwd(),
  'docs/cafe-exposure-keywords-2026-03-09.txt'
);
const SUMMARY_FILE = path.join(
  process.cwd(),
  'docs/cafe-exposure-check-summary.md'
);

const DEFAULT_TARGETS: CafeTarget[] = [
  { name: '쇼핑지름신' },
  { name: '샤넬오픈런' },
  { name: '건강한노후준비' },
  { name: '건강관리소' },
];

const shouldUseGuestMode = (): boolean =>
  process.env.CAFE_GUEST_MODE === 'true' || process.env.CAFE_SKIP_LOGIN === 'true';

const getTargets = (): CafeTarget[] => {
  const envTargets = String(process.env.CAFE_TARGET_NAMES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (envTargets.length > 0) {
    return envTargets.map((name) => ({ name }));
  }

  return DEFAULT_TARGETS;
};

const loadKeywords = (inputFile: string): KeywordLoadResult => {
  const content = fs.readFileSync(inputFile, 'utf8');
  const rawKeywords = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seenKeywords = new Set<string>();
  const keywords: string[] = [];
  let duplicateCount = 0;

  rawKeywords.forEach((keyword) => {
    if (seenKeywords.has(keyword)) {
      duplicateCount += 1;
      return;
    }

    seenKeywords.add(keyword);
    keywords.push(keyword);
  });

  return {
    rawCount: rawKeywords.length,
    duplicateCount,
    keywords,
    sourceLabel: inputFile,
  };
};

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

const normalizeHeader = (value: unknown): string =>
  normalizeCell(value).replace(/\s+/g, '');

const getGoogleAuth = (): JWT => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 또는 GOOGLE_PRIVATE_KEY 환경변수가 없음');
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const parseSheetIdFromUrl = (sheetUrl: string): string => {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? '';
};

const getSourceSheetConfig = () => {
  const sheetUrl = String(process.env.CAFE_SOURCE_SHEET_URL ?? '').trim();
  const sheetId =
    String(process.env.CAFE_SOURCE_SHEET_ID ?? '').trim() ||
    (sheetUrl ? parseSheetIdFromUrl(sheetUrl) : '');
  const sheetName = String(process.env.CAFE_SOURCE_SHEET_NAME ?? '').trim();
  const rawSheetGid = String(process.env.CAFE_SOURCE_SHEET_GID ?? '').trim();
  const sheetGid = rawSheetGid ? Number(rawSheetGid) : undefined;

  if (!sheetId) {
    return null;
  }

  return {
    sheetId,
    sheetName,
    sheetGid: Number.isFinite(sheetGid) ? sheetGid : undefined,
    sheetUrl,
  };
};

const getSourceSheet = (
  doc: GoogleSpreadsheet,
  sheetName?: string,
  sheetGid?: number
): GoogleSpreadsheetWorksheet => {
  if (sheetName) {
    const sheetByTitle = doc.sheetsByTitle[sheetName];
    if (sheetByTitle) {
      return sheetByTitle;
    }
  }

  if (typeof sheetGid === 'number') {
    const sheetById = doc.sheetsById[sheetGid];
    if (sheetById) {
      return sheetById;
    }
  }

  throw new Error('카페 키워드 소스 시트를 찾을 수 없음');
};

const loadKeywordsFromSheet = async (): Promise<KeywordLoadResult> => {
  const sourceSheetConfig = getSourceSheetConfig();

  if (!sourceSheetConfig) {
    throw new Error('CAFE_SOURCE_SHEET_ID 또는 CAFE_SOURCE_SHEET_URL 환경변수가 필요함');
  }

  const auth = getGoogleAuth();
  const doc = new GoogleSpreadsheet(sourceSheetConfig.sheetId, auth);
  await doc.loadInfo();

  const sheet = getSourceSheet(
    doc,
    sourceSheetConfig.sheetName,
    sourceSheetConfig.sheetGid
  );

  await sheet.loadCells();

  let headerRowIndex = -1;
  let keywordColumnIndex = -1;

  for (
    let rowIndex = 0;
    rowIndex < Math.min(sheet.rowCount, 10) && keywordColumnIndex === -1;
    rowIndex += 1
  ) {
    for (let columnIndex = 0; columnIndex < sheet.columnCount; columnIndex += 1) {
      const headerCell = sheet.getCell(rowIndex, columnIndex);
      const header = normalizeHeader(headerCell.value);

      if (header === '키워드' || header.includes('키워드')) {
        headerRowIndex = rowIndex;
        keywordColumnIndex = columnIndex;
        break;
      }
    }
  }

  if (keywordColumnIndex === -1) {
    throw new Error(`"${sheet.title}" 시트에서 키워드 컬럼을 찾을 수 없음`);
  }

  const rawKeywords: string[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < sheet.rowCount; rowIndex += 1) {
    const keyword = normalizeCell(sheet.getCell(rowIndex, keywordColumnIndex).value);

    if (keyword.length > 0) {
      rawKeywords.push(keyword);
    }
  }

  const seenKeywords = new Set<string>();
  const keywords: string[] = [];
  let duplicateCount = 0;

  rawKeywords.forEach((keyword) => {
    if (seenKeywords.has(keyword)) {
      duplicateCount += 1;
      return;
    }

    seenKeywords.add(keyword);
    keywords.push(keyword);
  });

  return {
    rawCount: rawKeywords.length,
    duplicateCount,
    keywords,
    sourceLabel: `${sourceSheetConfig.sheetId} / ${sheet.title}`,
  };
};

const loadKeywordsFromSource = async (inputFile: string): Promise<KeywordLoadResult> => {
  const sourceSheetConfig = getSourceSheetConfig();

  if (sourceSheetConfig) {
    return loadKeywordsFromSheet();
  }

  return loadKeywords(inputFile);
};

const createTargetStats = (targets: CafeTarget[]): Map<string, CafeTargetStat> =>
  new Map(
    targets.map((target) => [
      target.name,
      {
        name: target.name,
        matchedByNameCount: 0,
        matchedByIdCount: 0,
        sourceIds: new Set<string>(),
        actualNames: new Set<string>(),
      },
    ])
  );

const writeSummaryFile = (
  summaryPath: string,
  rows: CafeExposureRow[],
  targets: CafeTarget[],
  stats: Map<string, CafeTargetStat>,
  inputFile: string,
  rawCount: number,
  duplicateCount: number,
  csvPath: string
): void => {
  const exposedCount = rows.filter((row) => row.exposureStatus === '노출').length;
  const failedCount = rows.filter(
    (row) => row.exposureStatus === '확인실패'
  ).length;
  const timestamp = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
  });

  const targetLines = targets.map((target) => {
    const stat = stats.get(target.name);

    if (!stat) {
      return `- ${target.name}: 실행 통계가 없음`;
    }

    const sourceIds = Array.from(stat.sourceIds).join(', ') || '확인된 값 없음';
    const actualNames =
      Array.from(stat.actualNames).join(', ') || '검색 결과에서 이름 일치 미확인';

    if (stat.matchedByNameCount === 0 && stat.matchedByIdCount === 0) {
      return `- ${target.name}: 이번 실행에서는 이름 기준 매칭 결과를 확인하지 못함. sourceId도 확인하지 못함.`;
    }

    return `- ${target.name}: 이름 매칭 ${stat.matchedByNameCount}건, ID 매칭 ${stat.matchedByIdCount}건, 확인된 카페명 ${actualNames}, 확인된 sourceId ${sourceIds}`;
  });

  const content = [
    '# 네이버 카페 노출체크 정리',
    '',
    `- 실행 시각: ${timestamp}`,
    `- 기준: 네이버 통합검색 1페이지 카페 카드 기준`,
    `- 입력 파일: ${inputFile}`,
    `- 원본 키워드 수: ${rawCount}개`,
    `- 중복 제거 수: ${duplicateCount}개`,
    `- 실제 조회 키워드 수: ${rows.length}개`,
    `- 노출 키워드 수: ${exposedCount}개`,
    `- 확인 실패 키워드 수: ${failedCount}개`,
    `- 결과 CSV: ${csvPath}`,
    '',
    '## 카페명 체크 검토',
    ...targetLines,
    '',
    '## 메모',
    '- 현재 도구는 카페명과 카페 URL 식별자(sourceId)를 둘 다 쓸 수 있게 구성됨.',
    '- 이번 실행은 사용자가 준 카페명 4개를 기준으로 먼저 매칭했고, 검색 결과에서 확인된 sourceId를 함께 기록함.',
  ].join('\n');

  fs.writeFileSync(summaryPath, content, 'utf8');
};

const getHanryeodamwonCafeSheetConfig = () => {
  const sheetId =
    process.env.HANRYEODAMWON_CAFE_SHEET_ID ||
    process.env.CAFE_SHEET_ID ||
    HANRYEODAMWON_CAFE_SHEET_ID;

  const sheetName =
    process.env.HANRYEODAMWON_CAFE_SHEET_NAME ||
    process.env.CAFE_SHEET_NAME ||
    HANRYEODAMWON_CAFE_SHEET_NAME;

  const rawSheetGid =
    process.env.HANRYEODAMWON_CAFE_SHEET_GID ||
    process.env.CAFE_SHEET_GID ||
    String(HANRYEODAMWON_CAFE_SHEET_GID);

  const sheetGid = Number(rawSheetGid);

  return {
    sheetId,
    sheetName,
    sheetGid: Number.isFinite(sheetGid)
      ? sheetGid
      : HANRYEODAMWON_CAFE_SHEET_GID,
  };
};

const main = async (): Promise<void> => {
  const hanryeodamwonCafeSheet = getHanryeodamwonCafeSheetConfig();
  const inputFile = process.env.CAFE_KEYWORD_FILE || DEFAULT_INPUT_FILE;
  const targets = getTargets();
  const { rawCount, duplicateCount, keywords, sourceLabel } =
    await loadKeywordsFromSource(inputFile);

  logger.summary.start('카페 노출체크 시작', [
    { label: '대상 키워드', value: `${keywords.length}개` },
    { label: '중복 제거', value: `${duplicateCount}개` },
    { label: '키워드 소스', value: sourceLabel },
    { label: '대상 카페', value: targets.map((target) => target.name).join(', ') },
    { label: '로그인', value: shouldUseGuestMode() ? 'guest' : 'cookie' },
  ]);

  const rows: CafeExposureRow[] = [];
  const targetStats = createTargetStats(targets);

  for (let index = 0; index < keywords.length; index++) {
    const keyword = keywords[index];

    logger.statusLine.update(index + 1, keywords.length, keyword);

    try {
      const html = shouldUseGuestMode()
        ? await crawlWithRetryWithoutCookie(keyword)
        : await crawlWithRetry(keyword);
      const cafeItems = extractCafeItems(html);
      const matches = matchCafeTargets(cafeItems, targets);

      matches.forEach((match) => {
        const targetStat = targetStats.get(match.targetName);
        if (!targetStat) {
          return;
        }

        if (match.matchedBy === 'id') {
          targetStat.matchedByIdCount += 1;
        } else {
          targetStat.matchedByNameCount += 1;
        }

        if (match.sourceId) {
          targetStat.sourceIds.add(match.sourceId);
        }

        if (match.actualCafeName) {
          targetStat.actualNames.add(match.actualCafeName);
        }
      });

      const row = buildCafeExposureRow(keyword, matches);
      rows.push(row);

      const rankInfo = row.rank ? ` ${row.rank}위` : '';
      logger.statusLine.print(
        `[${index + 1}/${keywords.length}] ${keyword} -> ${row.exposureStatus}${rankInfo}${row.cafeName ? ` (${row.cafeName})` : ''}`
      );
    } catch (error) {
      const message = (error as Error).message || 'Unknown error';
      rows.push(buildCafeExposureRow(keyword, [], message));
      logger.statusLine.print(
        `[${index + 1}/${keywords.length}] ${keyword} -> 확인실패 (${message})`
      );
    }

    if (index < keywords.length - 1) {
      await randomDelay(700, 1400);
    }
  }

  logger.statusLine.done();

  const exposedRows = rows.filter((row) => row.exposureStatus === '노출' && row.link);
  if (exposedRows.length > 0) {
    logger.info(`노출 키워드 ${exposedRows.length}개 조회수/작성일 수집 시작`);

    for (let i = 0; i < exposedRows.length; i++) {
      const row = exposedRows[i];
      const links = row.link.split(' | ').filter((l) => l.length > 0);
      const viewCounts: string[] = [];
      const writeDates: string[] = [];

      for (const link of links) {
        const info = await fetchCafeArticleInfo(link);
        viewCounts.push(info.viewCount);
        writeDates.push(info.writeDate);
        await randomDelay(300, 600);
      }

      row.viewCount = viewCounts.filter((v) => v.length > 0).join(' | ');
      row.writeDate = writeDates.filter((v) => v.length > 0).join(' | ');
      logger.statusLine.print(
        `[${i + 1}/${exposedRows.length}] ${row.keyword} -> 조회수 ${row.viewCount} 작성일 ${row.writeDate}`
      );
    }

    logger.info('조회수/작성일 수집 완료');
  }

  const timestamp = getKSTTimestamp();
  const filename = `cafe-exposure-check_${timestamp}.csv`;
  const sheetFilename = `cafe-exposure-sheet_${timestamp}.csv`;
  const csvPath = saveCafeExposureCSV(rows, filename);
  const sheetPath = saveCafeExposureSheetCSV(rows, sheetFilename);

  writeSummaryFile(
    SUMMARY_FILE,
      rows,
      targets,
      targetStats,
      sourceLabel,
      rawCount,
      duplicateCount,
      csvPath
  );

  const exposedCount = rows.filter((row) => row.exposureStatus === '노출').length;
  const failedCount = rows.filter(
    (row) => row.exposureStatus === '확인실패'
  ).length;

  const isAppendMode = process.env.CAFE_EXPORT_MODE === 'append';
  let sheetExportStatus = `${hanryeodamwonCafeSheet.sheetName} 시트 내보내기 실패`;
  try {
    if (isAppendMode) {
      await appendCafeExposureToSheet(
        rows,
        hanryeodamwonCafeSheet.sheetId,
        hanryeodamwonCafeSheet.sheetName,
        hanryeodamwonCafeSheet.sheetGid
      );
    } else {
      await exportCafeExposureToSheet(
        rows,
        hanryeodamwonCafeSheet.sheetId,
        hanryeodamwonCafeSheet.sheetName,
        hanryeodamwonCafeSheet.sheetGid
      );
    }
    sheetExportStatus = `${hanryeodamwonCafeSheet.sheetName} 시트에 내보내기 완료`;
  } catch (error) {
    logger.error(`Google Sheets 내보내기 실패: ${(error as Error).message}`);
    sheetExportStatus = `${hanryeodamwonCafeSheet.sheetName} 시트 내보내기 실패`;
  }

  logger.summary.complete('카페 노출체크 완료', [
    { label: '조회 키워드', value: `${rows.length}개` },
    { label: '노출 키워드', value: `${exposedCount}개` },
    { label: '확인 실패', value: `${failedCount}개` },
    { label: 'CSV', value: csvPath },
    { label: '시트CSV', value: sheetPath },
    { label: 'Google Sheets', value: sheetExportStatus },
    { label: '정리파일', value: SUMMARY_FILE },
  ]);
};

main().catch((error) => {
  logger.statusLine.done();
  logger.summary.error('카페 노출체크 실패', [
    { label: '에러', value: (error as Error).message || 'Unknown error' },
  ]);
  process.exit(1);
});
