import {
  getPageCheckKeywords,
  type IKeyword,
  type IPageCheckKeyword,
  type PageCheckSheetType,
} from '../../database';
import { syncAndLoadDogmaruKeywords } from '../exposure-suite/dogmaru-composite-target';
import { waitForAllOrThrow } from '../exposure-suite/settle';
import { logger } from '../logger';
import {
  PAGE_CHECK_SHEET_TYPE_NAMES,
} from './config';
import { importSheetAPI } from './sheet-api';

export interface LoadedPageCheckTargets {
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>;
  dogmaruKeywords: IKeyword[];
  totalPageKeywords: number;
  totalKeywords: number;
}

export const syncPageSheetTypes = async (
  activeSheetTypes: PageCheckSheetType[]
): Promise<void> => {
  if (activeSheetTypes.length === 0) return;

  const syncedCounts = await Promise.all(
    activeSheetTypes.map((sheetType) => importSheetAPI(sheetType))
  );
  const totalSynced = syncedCounts.reduce((sum, count) => sum + count, 0);
  logger.info(`📥 ${totalSynced}개 키워드 동기화 완료`);
};

export const syncAndLoadPageCheckTargets = async (
  activeSheetTypes: PageCheckSheetType[],
  includesDogmaru: boolean
): Promise<LoadedPageCheckTargets> => {
  logger.divider('시트 동기화');
  const [dogmaruKeywords = []] = await waitForAllOrThrow([
    includesDogmaru ? syncAndLoadDogmaruKeywords() : Promise.resolve([]),
    syncPageSheetTypes(activeSheetTypes).then(() => []),
  ]);
  logger.blank();

  const keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]> = {
    pet: [],
    suripet: [],
  };

  logger.divider('키워드 조회');
  for (const sheetType of activeSheetTypes) {
    const keywords = await getPageCheckKeywords(sheetType);
    keywordsBySheet[sheetType] = keywords;
    logger.info(`  ${PAGE_CHECK_SHEET_TYPE_NAMES[sheetType]}: ${keywords.length}개`);
  }

  const totalPageKeywords = Object.values(keywordsBySheet).reduce(
    (sum, keywords) => sum + keywords.length,
    0
  );
  const totalKeywords = totalPageKeywords + dogmaruKeywords.length;
  if (includesDogmaru) logger.info(`  도그마루: ${dogmaruKeywords.length}개`);
  logger.info(`📋 총 ${totalKeywords}개 키워드 로드 완료`);
  logger.blank();

  return {
    keywordsBySheet,
    dogmaruKeywords,
    totalPageKeywords,
    totalKeywords,
  };
};
