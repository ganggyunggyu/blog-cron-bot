import type {
  IKeyword,
  IPageCheckKeyword,
  PageCheckSheetType,
} from '../../database';
import { PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE } from '../../constants/blog-ids';
import { getSearchQuery } from '../../utils';
import {
  getExposureConcurrency,
  splitConcurrencyBudget,
} from '../exposure-run-config';
import { buildDogPetCompositeCrawlInputs } from '../exposure-suite/dog-pet-composite';
import {
  SharedCrawlCoordinator,
  buildSharedCrawlPlans,
} from '../keyword-processor/shared-crawl-coordinator';
import type { SharedCrawlContext } from '../keyword-processor/types';
import {
  getMaxPagesForPageCheckSheet,
  type PageCheckRunTarget,
} from './config';

export interface PageCheckCrawlSetup {
  totalConcurrency: number;
  taskConcurrency: number;
  perTaskConcurrency: number;
  sharedCrawlContext?: SharedCrawlContext;
  isDogPetComposite: boolean;
}

interface BuildPageCheckCrawlSetupInput {
  activeTargets: PageCheckRunTarget[];
  activeSheetTypes: PageCheckSheetType[];
  keywordsBySheet: Record<PageCheckSheetType, IPageCheckKeyword[]>;
  dogmaruKeywords: IKeyword[];
}

const getSharedCrawlPlanInputs = (
  input: BuildPageCheckCrawlSetupInput,
  nonEmptySheetTypes: PageCheckSheetType[],
  isDogPetComposite: boolean
) => {
  const { activeSheetTypes, keywordsBySheet, dogmaruKeywords } = input;
  const isPetComposite =
    !isDogPetComposite &&
    nonEmptySheetTypes.length === 2 &&
    nonEmptySheetTypes.includes('pet') &&
    nonEmptySheetTypes.includes('suripet');

  if (isDogPetComposite) {
    return buildDogPetCompositeCrawlInputs(
      {
        dogmaru: dogmaruKeywords.map((keyword) => getSearchQuery(keyword.keyword)),
        pet: keywordsBySheet.pet.map((keyword) => getSearchQuery(keyword.keyword)),
        suripet: keywordsBySheet.suripet.map((keyword) =>
          getSearchQuery(keyword.keyword)
        ),
      },
      getMaxPagesForPageCheckSheet('pet'),
      getMaxPagesForPageCheckSheet('suripet')
    );
  }

  if (!isPetComposite) return undefined;

  return activeSheetTypes.map((sheetType) => ({
    searchQueries: keywordsBySheet[sheetType].map((keyword) =>
      getSearchQuery(keyword.keyword)
    ),
    maxPages: getMaxPagesForPageCheckSheet(sheetType),
    blogIds: PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE[sheetType],
  }));
};

export const buildPageCheckCrawlSetup = (
  input: BuildPageCheckCrawlSetupInput
): PageCheckCrawlSetup => {
  const { activeTargets, activeSheetTypes, keywordsBySheet, dogmaruKeywords } = input;
  const nonEmptySheetTypes = activeSheetTypes.filter(
    (sheetType) => keywordsBySheet[sheetType].length > 0
  );
  const totalConcurrency = getExposureConcurrency();
  const { taskConcurrency, perTaskConcurrency } = splitConcurrencyBudget(
    totalConcurrency,
    nonEmptySheetTypes.length + (dogmaruKeywords.length > 0 ? 1 : 0)
  );
  const isDogPetComposite =
    activeTargets.includes('dogmaru') &&
    activeSheetTypes.length === 2 &&
    activeSheetTypes.includes('pet') &&
    activeSheetTypes.includes('suripet');
  const sharedPlanInputs = getSharedCrawlPlanInputs(
    input,
    nonEmptySheetTypes,
    isDogPetComposite
  );

  return {
    totalConcurrency,
    taskConcurrency,
    perTaskConcurrency,
    isDogPetComposite,
    sharedCrawlContext: sharedPlanInputs
      ? {
          coordinator: new SharedCrawlCoordinator(totalConcurrency),
          plans: buildSharedCrawlPlans(sharedPlanInputs),
        }
      : undefined,
  };
};
