import * as dotenv from 'dotenv';
import os from 'os';
import { main as runCrawl } from './index';
import { syncKeywords, importKeywords } from './api';
import { importRes, requests, SHEET_TYPE, SheetType } from './constants';
import { logger } from './lib/logger';

dotenv.config();

const SHEET_LABELS: Record<SheetType, string> = {
  [SHEET_TYPE.PACKAGE]: '패키지',
  [SHEET_TYPE.DOGMARU_EXCLUDE]: '일반건',
  [SHEET_TYPE.DOGMARU]: '도그마루',
};

const normalizeTargetSheetType = (value: string): SheetType | null => {
  const normalized = value.toLowerCase().replace(/\s+/g, '').trim();

  if (normalized === SHEET_TYPE.PACKAGE || normalized === '패키지') {
    return SHEET_TYPE.PACKAGE;
  }
  if (
    normalized === 'general' ||
    normalized === '일반건' ||
    normalized === SHEET_TYPE.DOGMARU_EXCLUDE
  ) {
    return SHEET_TYPE.DOGMARU_EXCLUDE;
  }
  if (normalized === SHEET_TYPE.DOGMARU) return SHEET_TYPE.DOGMARU;

  return null;
};

const getTargetSheetType = (): SheetType => {
  const rawTarget = process.argv[2] || process.env.ONLY_SHEET_TYPE || '';
  const targetSheetType = normalizeTargetSheetType(rawTarget);

  if (!targetSheetType) {
    logger.error('유효하지 않은 sheetType입니다.');
    logger.info('사용 가능: package, general, dogmaru-exclude, dogmaru');
    process.exit(1);
  }

  return targetSheetType;
};

const getSheetIndex = (sheetType: SheetType): number => {
  const index = requests.findIndex((request) => request.sheetType === sheetType);

  if (index === -1 || !importRes[index]) {
    logger.error(`시트 설정을 찾을 수 없습니다: ${sheetType}`);
    process.exit(1);
  }

  return index;
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
  return `${seconds}초`;
};

const runSheetWorkflow = async () => {
  const startTime = Date.now();
  const targetSheetType = getTargetSheetType();
  const sheetIndex = getSheetIndex(targetSheetType);
  const label = SHEET_LABELS[targetSheetType];

  process.env.ONLY_SHEET_TYPE = targetSheetType;

  logger.summary.start(`${label} PAGES CRON START`, [
    { label: '시작', value: new Date().toLocaleString('ko-KR') },
    { label: 'OS', value: `${os.platform()} (${os.arch()})` },
    {
      label: '페이지',
      value:
        process.env.EXPOSURE_MAX_PAGES ||
        process.env.PAGE_CHECK_MAX_PAGES ||
        '1',
    },
  ]);

  logger.step(1, 3, `${label} 시트 동기화`);
  await syncKeywords(requests[sheetIndex]);
  logger.step(1, 3, `${label} 시트 동기화`, 'done');

  logger.step(2, 3, `${label} 노출 체크`);
  await runCrawl();
  logger.step(2, 3, `${label} 노출 체크`, 'done');

  logger.step(3, 3, `${label} 시트 반영`);
  const importResult = await importKeywords(importRes[sheetIndex]);
  logger.result(label, `${importResult.updated || 0}건`);
  logger.step(3, 3, `${label} 시트 반영`, 'done');

  logger.summary.complete(`${label} PAGES CRON COMPLETE`, [
    { label: '완료', value: new Date().toLocaleString('ko-KR') },
    { label: '소요', value: formatDuration(Date.now() - startTime) },
    { label: '시트 업데이트', value: `${importResult.updated || 0}건` },
  ]);
};

runSheetWorkflow().catch((error) => {
  logger.error(`전용 pages 크론 오류: ${(error as Error).message}`);
  process.exit(1);
});
