import type {
  IPageCheckKeyword,
  PageCheckSheetType,
} from '../../database';
import { saveToCSV, saveToSheetCSV } from '../../csv-writer';
import { getKSTTimestamp } from '../../utils';
import { exportAllSheetsAPI, exportSheetAPI } from './sheet-api';
import { finalizeDogmaruCompositeTarget, type DogmaruCompositeResult } from '../exposure-suite/dogmaru-composite-target';
import { logger } from '../logger';
import type { ExposureResult } from '../../matcher';
import type { SheetProcessResult } from './page-keyword-processor';

interface SavePageCheckResultsInput {
  activeSheetTypes: PageCheckSheetType[];
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>;
  sheetResults: SheetProcessResult[];
  dogmaruResult?: DogmaruCompositeResult;
  keywordLogicMap: Map<string, boolean>;
  startedAt: number;
}

export interface SavedPageCheckResults {
  allResults: ExposureResult[];
  timestamp: string;
}

const savePageCheckCsv = (
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>,
  allResults: ExposureResult[],
  keywordLogicMap: Map<string, boolean>,
  timestamp: string
): void => {
  saveToCSV(allResults, `pages_${timestamp}.csv`);
  const keywords = Object.values(keywordsBySheet).flat();
  saveToSheetCSV(
    keywords.map((keyword) => ({
      keyword: keyword.keyword,
      company: keyword.company,
    })),
    allResults,
    `pages_sheet_${timestamp}.csv`,
    keywordLogicMap
  );
};

const exportPageCheckSheets = async (
  activeSheetTypes: PageCheckSheetType[]
): Promise<void> => {
  logger.divider('전체 내보내기');
  for (const sheetType of activeSheetTypes) await exportSheetAPI(sheetType);

  if (process.env.SKIP_PAGE_CHECK_EXPORT_ALL === 'true') {
    logger.info('  종합: 다중 워커 조정 프로세스에서 마지막에 한 번만 반영');
    return;
  }

  await exportAllSheetsAPI();
};

export const saveAndExportPageCheckResults = async ({
  activeSheetTypes,
  keywordsBySheet,
  sheetResults,
  dogmaruResult,
  keywordLogicMap,
  startedAt,
}: SavePageCheckResultsInput): Promise<SavedPageCheckResults> => {
  const allResults = sheetResults.flatMap(({ results }) => results);
  const timestamp = getKSTTimestamp();
  savePageCheckCsv(keywordsBySheet, allResults, keywordLogicMap, timestamp);
  await exportPageCheckSheets(activeSheetTypes);

  if (dogmaruResult) {
    await finalizeDogmaruCompositeTarget(dogmaruResult, startedAt);
  }
  logger.blank();

  return { allResults, timestamp };
};
