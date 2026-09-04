import * as dotenv from 'dotenv';
import { disconnectDB } from './database';
import {
  getPageCheckUsage,
  selectPageCheckTargets,
} from './lib/page-check/cli';
import { logger } from './lib/logger';
import { closeBrowser } from './lib/playwright-crawler';
import { runPageCheckWorkflow } from './lib/page-check/workflow';
import type { PageCheckRunTarget } from './lib/page-check/config';

export {
  exportAllSheetsAPI,
  exportSheetAPI,
  importSheetAPI,
  syncAllSheetsAPI,
} from './lib/page-check/sheet-api';
export {
  syncPetKeywordsFromSheetToDB,
  syncSuripetKeywordsFromSheetToDB,
} from './lib/page-check/sheet-direct';
export { processSheetKeywords } from './lib/page-check/page-keyword-processor';

dotenv.config();

export const main = async (
  targetSheetTypes?: PageCheckRunTarget[]
): Promise<void> => {
  try {
    await runPageCheckWorkflow(targetSheetTypes);
  } finally {
    try {
      await closeBrowser();
    } finally {
      await disconnectDB();
    }
  }
};

const runCli = (): void => {
  const selection = selectPageCheckTargets(process.argv.slice(2));
  if (selection.error) {
    logger.error(selection.error);
    logger.info(getPageCheckUsage());
    process.exit(1);
  }
  if (selection.notice) logger.info(selection.notice);

  main(selection.targetSheetTypes).catch((error: unknown) => {
    logger.error(`프로그램 오류: ${(error as Error).message}`);
    process.exit(1);
  });
};

if (require.main === module) runCli();
