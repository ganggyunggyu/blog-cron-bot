import { ExposureResult } from '../../matcher';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { VendorMatchDetails, GuestRetryComparison } from '../../types';

export type KeywordType = 'restaurant' | 'pet' | 'basic';

export type UpdateFunction = (
  keywordId: string,
  visibility: boolean,
  popularTopic: string,
  url: string,
  keywordType: KeywordType,
  restaurantName?: string,
  matchedTitle?: string,
  rank?: number,
  postVendorName?: string,
  rankWithCafe?: number,
  isUpdateRequired?: boolean,
  isNewLogic?: boolean,
  foundPage?: number
) => Promise<void>;

export interface ProcessKeywordsOptions {
  updateFunction?: UpdateFunction;
  isLoggedIn?: boolean;
  maxPages?: number;
}

export interface KeywordDoc {
  _id: unknown;
  keyword: string;
  company?: string;
  restaurantName?: string;
  sheetType?: string;
}

export interface KeywordContext {
  keywordDoc: KeywordDoc;
  query: string;
  searchQuery: string;
  restaurantName: string;
  vendorTarget: string;
  keywordType: KeywordType;
}

export interface ProcessingContext {
  globalIndex: number;
  totalKeywords: number;
  keywordStartTime: number;
  logBuilder: DetailedLogBuilder;
}

export interface HtmlStructure {
  items: any[];
  isPopular: boolean;
  uniqueGroupsSize: number;
  topicNamesArray: string[];
}

export interface CrawlCaches {
  crawlCache: Map<string, string>;
  itemsCache: Map<string, any[]>;
  matchQueueMap: Map<string, ExposureResult[]>;
  htmlStructureCache: Map<string, {
    isPopular: boolean;
    uniqueGroups: number;
    topicNames: string[];
  }>;
  guestAddedLinksCache: Map<string, Set<string>>;
  usedLinksCache: Map<string, Set<string>>;
}

export interface GuestRetryParams {
  searchQuery: string;
  query: string;
  keywordDoc: KeywordDoc;
  topicNamesArray: string[];
  matchQueue: ExposureResult[];
  vendorTarget: string;
  restaurantName: string;
  caches: CrawlCaches;
  baseMatchesCount: number;
  existingLinks: Set<string>;
  logNewMatches?: boolean;
}

export interface GuestRetryResult {
  attempted: boolean;
  recovered: boolean;
  guestMatchesCount: number;
  addedMatchesCount: number;
  retryResult?: {
    matchedIndex: number;
    match: ExposureResult;
    vendor: string;
    vendorDetails?: VendorMatchDetails;
    source: 'VENDOR' | 'TITLE' | '';
  };
  guestRetryComparison?: GuestRetryComparison;
}

export interface MatchResult {
  nextMatch: ExposureResult;
  extractedVendor: string;
  matchSource: 'VENDOR' | 'TITLE' | '';
  vendorMatchDetails?: VendorMatchDetails;
  allMatchesCount: number;
  remainingQueueCount: number;
}

export interface CrawlParams {
  searchQuery: string;
  keywordDoc: KeywordDoc;
  query: string;
  keywordType: KeywordType;
  processing: ProcessingContext;
  caches: CrawlCaches;
}

export interface ExcludedParams {
  keyword: KeywordContext;
  company: string;
  processing: ProcessingContext;
  updateFunction: UpdateFunction;
  isNewLogic: boolean;
}

export interface QueueEmptyParams {
  keyword: KeywordContext;
  html: HtmlStructure;
  processing: ProcessingContext;
  updateFunction: UpdateFunction;
}

export interface SuccessParams {
  keyword: KeywordContext;
  html: HtmlStructure;
  match: MatchResult;
  processing: ProcessingContext;
  allResults: ExposureResult[];
  updateFunction: UpdateFunction;
  guestRetryComparison?: GuestRetryComparison;
}

export interface FilterFailureParams {
  keyword: KeywordContext;
  html: HtmlStructure;
  allMatchesCount: number;
  remainingQueueCount: number;
  processing: ProcessingContext;
  updateFunction: UpdateFunction;
  guestRetryComparison?: GuestRetryComparison;
}
