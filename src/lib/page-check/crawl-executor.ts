import type {
  IKeyword,
  IPageCheckKeyword,
  PageCheckSheetType,
} from '../../database';
import { getMaxPagesForPageCheckSheet } from './config';
import { buildPageCheckCrawlSetup } from './crawl-context';
import { logger } from '../logger';
import { launchBrowser } from '../playwright-crawler';
import {
  processDogmaruCompositeTarget,
  type DogmaruCompositeResult,
} from '../exposure-suite/dogmaru-composite-target';
import { waitForAllOrThrow } from '../exposure-suite/settle';
import {
  processSheetKeywords,
  type SheetProcessResult,
} from './page-keyword-processor';
import type { PageCheckRunTarget } from './config';

export interface PageCheckCrawlResult {
  sheetResults: SheetProcessResult[];
  dogmaruResult?: DogmaruCompositeResult;
  keywordLogicMap: Map<string, boolean>;
}

interface ExecutePageCheckCrawlInput {
  activeTargets: PageCheckRunTarget[];
  activeSheetTypes: PageCheckSheetType[];
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>;
  dogmaruKeywords: IKeyword[];
  isLoggedIn: boolean;
}

const logCrawlSetup = (
  isDogPetComposite: boolean,
  totalConcurrency: number,
  taskConcurrency: number,
  perTaskConcurrency: number,
  sharedPlanCount?: number
): void => {
  if (sharedPlanCount !== undefined) {
    const label = isDogPetComposite
      ? '도그마루·애견·서리펫'
      : '애견·서리펫';
    logger.info(
      `⚡ ${label} 처리 워커 각 ${totalConcurrency}, 외부 요청 합계 최대 ${totalConcurrency}`
    );
    logger.info(`♻️ ${sharedPlanCount}개 고유 검색어 크롤 결과 공유`);
    return;
  }

  logger.info(
    `⚡ 총 동시성 ${totalConcurrency}: 시트 ${taskConcurrency}개 × 시트당 키워드 ${perTaskConcurrency}개`
  );
};

const runSharedCrawl = async (
  activeSheetTypes: PageCheckSheetType[],
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>,
  dogmaruKeywords: IKeyword[],
  isLoggedIn: boolean,
  totalConcurrency: number,
  keywordLogicMap: Map<string, boolean>,
  sharedCrawlContext: NonNullable<ReturnType<typeof buildPageCheckCrawlSetup>['sharedCrawlContext']>
): Promise<Pick<PageCheckCrawlResult, 'sheetResults' | 'dogmaruResult'>> => {
  type SharedTargetResult =
    | { target: 'page'; result: SheetProcessResult }
    | { target: 'dogmaru'; result: DogmaruCompositeResult };
  const promises: Promise<SharedTargetResult>[] = activeSheetTypes
    .filter((sheetType) => keywordsBySheet[sheetType].length > 0)
    .map(async (sheetType) => ({
      target: 'page' as const,
      result: await processSheetKeywords(
        sheetType,
        keywordsBySheet[sheetType],
        isLoggedIn,
        totalConcurrency,
        keywordLogicMap,
        sharedCrawlContext
      ),
    }));

  if (dogmaruKeywords.length > 0) {
    promises.push(
      processDogmaruCompositeTarget(
        dogmaruKeywords,
        isLoggedIn,
        totalConcurrency,
        sharedCrawlContext
      ).then((result) => ({ target: 'dogmaru' as const, result }))
    );
  }

  const sheetResults: SheetProcessResult[] = [];
  let dogmaruResult: DogmaruCompositeResult | undefined;
  const targetResults = await waitForAllOrThrow(promises);
  targetResults.forEach((targetResult) => {
    if (targetResult.target === 'dogmaru') dogmaruResult = targetResult.result;
    else sheetResults.push(targetResult.result);
  });

  return { sheetResults, dogmaruResult };
};

const runIndependentCrawl = async (
  activeSheetTypes: PageCheckSheetType[],
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>,
  isLoggedIn: boolean,
  taskConcurrency: number,
  perTaskConcurrency: number,
  keywordLogicMap: Map<string, boolean>
): Promise<SheetProcessResult[]> => {
  const nonEmptySheetTypes = activeSheetTypes.filter(
    (sheetType) => keywordsBySheet[sheetType].length > 0
  );
  const sheetResults: SheetProcessResult[] = [];

  for (let index = 0; index < nonEmptySheetTypes.length; index += taskConcurrency) {
    const batch = nonEmptySheetTypes.slice(index, index + taskConcurrency);
    const batchResults = await waitForAllOrThrow(
      batch.map((sheetType) =>
        processSheetKeywords(
          sheetType,
          keywordsBySheet[sheetType],
          isLoggedIn,
          perTaskConcurrency,
          keywordLogicMap
        )
      )
    );
    sheetResults.push(...batchResults);
  }

  return sheetResults;
};

export const executePageCheckCrawl = async (
  input: ExecutePageCheckCrawlInput
): Promise<PageCheckCrawlResult> => {
  const setup = buildPageCheckCrawlSetup(input);
  const keywordLogicMap = new Map<string, boolean>();
  logCrawlSetup(
    setup.isDogPetComposite,
    setup.totalConcurrency,
    setup.taskConcurrency,
    setup.perTaskConcurrency,
    setup.sharedCrawlContext?.plans.size
  );

  const shouldPrewarmBrowser = input.activeSheetTypes.some(
    (sheetType) => getMaxPagesForPageCheckSheet(sheetType) > 1
  );
  if (setup.totalConcurrency > 1 && shouldPrewarmBrowser) await launchBrowser();

  if (setup.sharedCrawlContext) {
    return {
      ...(await runSharedCrawl(
        input.activeSheetTypes,
        input.keywordsBySheet,
        input.dogmaruKeywords,
        input.isLoggedIn,
        setup.totalConcurrency,
        keywordLogicMap,
        setup.sharedCrawlContext
      )),
      keywordLogicMap,
    };
  }

  return {
    sheetResults: await runIndependentCrawl(
      input.activeSheetTypes,
      input.keywordsBySheet,
      input.isLoggedIn,
      setup.taskConcurrency,
      setup.perTaskConcurrency,
      keywordLogicMap
    ),
    keywordLogicMap,
  };
};
