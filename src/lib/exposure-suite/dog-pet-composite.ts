import {
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE,
} from '../../constants/blog-ids';
import type { SharedCrawlTargetInput } from '../keyword-processor/shared-crawl-coordinator';

export const DOGMARU_COMPOSITE_MAX_PAGES = 1;

interface DogPetCompositeQueries {
  dogmaru: Iterable<string>;
  pet: Iterable<string>;
  suripet: Iterable<string>;
}

export const buildDogPetCompositeCrawlInputs = (
  queries: DogPetCompositeQueries,
  petMaxPages: number,
  suripetMaxPages: number
): SharedCrawlTargetInput[] => [
  {
    searchQueries: queries.dogmaru,
    maxPages: DOGMARU_COMPOSITE_MAX_PAGES,
    blogIds: DOGMARU_PAGE_CHECK_BLOG_IDS,
  },
  {
    searchQueries: queries.pet,
    maxPages: petMaxPages,
    blogIds: PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE.pet,
  },
  {
    searchQueries: queries.suripet,
    maxPages: suripetMaxPages,
    blogIds: PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE.suripet,
  },
];
