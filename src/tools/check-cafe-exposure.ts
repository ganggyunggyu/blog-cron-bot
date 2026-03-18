import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { crawlWithRetry, randomDelay } from '../crawler';
import { saveCafeExposureCSV, saveCafeExposureSheetCSV } from '../csv-writer';
import {
  buildCafeExposureRow,
  CafeExposureRow,
  CafeTarget,
  matchCafeTargets,
  extractCafeItems,
} from '../lib/cafe-exposure-check';
import { exportCafeExposureToSheet, appendCafeExposureToSheet } from '../lib/google-sheets';
import { logger } from '../lib/logger';
import { getKSTTimestamp } from '../utils';

dotenv.config();

const DEFAULT_CAFE_SHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const DEFAULT_CAFE_SHEET_NAME = '카페침투';

interface KeywordLoadResult {
  rawCount: number;
  duplicateCount: number;
  keywords: string[];
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
  };
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

const main = async (): Promise<void> => {
  const cafeSheetId = process.env.CAFE_SHEET_ID || DEFAULT_CAFE_SHEET_ID;
  const cafeSheetName = process.env.CAFE_SHEET_NAME || DEFAULT_CAFE_SHEET_NAME;
  const inputFile = process.env.CAFE_KEYWORD_FILE || DEFAULT_INPUT_FILE;
  const targets = getTargets();
  const { rawCount, duplicateCount, keywords } = loadKeywords(inputFile);

  logger.summary.start('카페 노출체크 시작', [
    { label: '대상 키워드', value: `${keywords.length}개` },
    { label: '중복 제거', value: `${duplicateCount}개` },
    { label: '대상 카페', value: targets.map((target) => target.name).join(', ') },
  ]);

  const rows: CafeExposureRow[] = [];
  const targetStats = createTargetStats(targets);

  for (let index = 0; index < keywords.length; index++) {
    const keyword = keywords[index];

    logger.statusLine.update(index + 1, keywords.length, keyword);

    try {
      const html = await crawlWithRetry(keyword);
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
    inputFile,
    rawCount,
    duplicateCount,
    csvPath
  );

  const exposedCount = rows.filter((row) => row.exposureStatus === '노출').length;
  const failedCount = rows.filter(
    (row) => row.exposureStatus === '확인실패'
  ).length;

  const isAppendMode = process.env.CAFE_EXPORT_MODE === 'append';
  let sheetExportStatus = `${cafeSheetName} 시트 내보내기 실패`;
  try {
    if (isAppendMode) {
      await appendCafeExposureToSheet(rows, cafeSheetId, cafeSheetName);
    } else {
      await exportCafeExposureToSheet(rows, cafeSheetId, cafeSheetName);
    }
    sheetExportStatus = `${cafeSheetName} 시트에 내보내기 완료`;
  } catch (error) {
    logger.error(`Google Sheets 내보내기 실패: ${(error as Error).message}`);
    sheetExportStatus = `${cafeSheetName} 시트 내보내기 실패`;
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
