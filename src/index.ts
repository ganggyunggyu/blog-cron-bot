import * as dotenv from 'dotenv';
import { connectDB, disconnectDB, getAllKeywords } from './database';
import { saveToCSV } from './csv-writer';
import { getSheetOptions } from './sheet-config';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { logger } from './lib/logger';

dotenv.config();

export async function main() {
  const startTime = Date.now();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  const allKeywords = await getAllKeywords();

  const onlySheetType = (process.env.ONLY_SHEET_TYPE || '').trim();
  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

  let filtered = allKeywords;
  const normalize = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');

  if (onlySheetType)
    filtered = filtered.filter(
      (k: any) => normalize(k.sheetType) === normalize(onlySheetType)
    );
  if (onlyCompany)
    filtered = filtered.filter(
      (k: any) => normalize(k.company) === normalize(onlyCompany)
    );
  if (onlyKeywordRegex) {
    try {
      const re = new RegExp(onlyKeywordRegex);
      filtered = filtered.filter((k: any) => re.test(k.keyword));
    } catch {}
  }
  if (onlyId) {
    filtered = filtered.filter((k: any) => String(k._id) === onlyId);
  }

  const startIndexRaw = Number(process.env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexRaw)
    ? Math.max(0, Math.min(startIndexRaw, filtered.length))
    : 0;

  const keywords = filtered.slice(startIndex);
  logger.info(
    `📋 검색어 ${keywords.length}개 처리 예정 (필터 applied, start=${startIndex})`
  );
  logger.blank();

  const logBuilder = createDetailedLogBuilder();

  const allResults = await processKeywords(keywords, logBuilder);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filterSheet = (process.env.ONLY_SHEET_TYPE || '').trim();
  const csvPrefix = filterSheet
    ? getSheetOptions(filterSheet).csvFilePrefix
    : 'results';
  const filename = `${csvPrefix}_${timestamp}.csv`;

  saveToCSV(allResults, filename);

  const elapsedMs = Date.now() - startTime;
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
  const elapsedTimeStr =
    hours > 0
      ? `${hours}시간 ${minutes}분 ${seconds}초`
      : minutes > 0
      ? `${minutes}분 ${seconds}초`
      : `${seconds}초`;

  const popularCount = allResults.filter((r) => r.exposureType === '인기글').length;
  const sblCount = allResults.filter((r) => r.exposureType === '스블').length;

  logger.summary.complete('크롤링 완료 요약', [
    { label: '총 검색어', value: `${keywords.length}개` },
    { label: '총 노출 발견', value: `${allResults.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '처리 시간', value: elapsedTimeStr },
  ]);

  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, timestamp, elapsedTimeStr);

  const stats = logBuilder.getStats();
  logger.summary.complete('상세 로그 저장 완료', [
    { label: '총 로그 엔트리', value: `${stats.total}개` },
    { label: '성공', value: `${stats.success}개` },
    { label: '실패', value: `${stats.failed}개` },
  ]);

  await disconnectDB();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
}
