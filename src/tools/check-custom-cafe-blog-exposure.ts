import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { runCustomExposureChecks } from '../lib/custom-cafe-blog-check/checker';
import {
  loadCafeExposureTargets,
  loadCustomExposureRows,
  writeCustomExposureResults,
} from '../lib/custom-cafe-blog-check/sheet';
import { resolveOutputFilePath } from '../lib/csv-output/output-path';
import { logger } from '../lib/logger';
import { getKSTTimestamp } from '../utils';

dotenv.config();

const targetTab =
  process.argv.find((value) => value.startsWith('--tab='))?.slice(6) ||
  '카페 노출체크 0722';

const main = async (): Promise<void> => {
  const [rows, targets] = await Promise.all([
    loadCustomExposureRows(targetTab),
    loadCafeExposureTargets(),
  ]);
  const keywords = Array.from(new Set(rows.map(({ keyword }) => keyword)));
  logger.info(
    `${targetTab}: ${rows.length}행 / 고유 키워드 ${keywords.length}개 / 카페 ${targets.length}개`
  );
  const results = await runCustomExposureChecks(keywords, targets);
  await writeCustomExposureResults(targetTab, rows, results);
  const summary = {
    tab: targetTab,
    rows: rows.length,
    uniqueKeywords: keywords.length,
    exposed: rows.filter(
      ({ keyword }) => results.get(keyword)?.exposureStatus === '노출'
    ).length,
    unexposed: rows.filter(
      ({ keyword }) => results.get(keyword)?.exposureStatus === '미노출'
    ).length,
    failed: rows.filter(
      ({ keyword }) => results.get(keyword)?.exposureStatus === '확인실패'
    ).length,
  };
  const outputPath = resolveOutputFilePath(
    `cafe_custom_0722_${getKSTTimestamp()}.json`
  );
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify({ summary, rows, results: Object.fromEntries(results) }, null, 2)}\n`
  );
  logger.success(`${targetTab} 반영 및 재조회 완료: ${JSON.stringify(summary)}`);
  logger.success(`결과 저장: ${outputPath}`);
};

main().catch((error) => {
  logger.error(`카페+블로그 통합 노출체크 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
