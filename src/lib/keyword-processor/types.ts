import { ExposureResult } from '../../matcher';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { VendorMatchDetails, GuestRetryComparison } from '../../types';

export type KeywordType = 'restaurant' | 'pet' | 'basic';

/** DB 업데이트 함수 타입 */
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
  isNewLogic?: boolean
) => Promise<void>;

/** processKeywords 옵션 */
export interface ProcessKeywordsOptions {
  updateFunction?: UpdateFunction;
  /** 로그인 모드 여부 (비로그인이면 게스트 재시도 스킵) */
  isLoggedIn?: boolean;
}

/** 키워드 문서 정보 */
export interface KeywordDoc {
  _id: string;
  keyword: string;
  company?: string;
  restaurantName?: string;
  sheetType?: string;
}

/** 키워드 컨텍스트 (핸들러에서 공통으로 사용) */
export interface KeywordContext {
  keywordDoc: KeywordDoc;
  query: string;
  searchQuery: string;
  restaurantName: string;
  vendorTarget: string;
  keywordType: KeywordType;
}

/** 처리 진행 컨텍스트 */
export interface ProcessingContext {
  globalIndex: number;
  totalKeywords: number;
  keywordStartTime: number;
  logBuilder: DetailedLogBuilder;
}

/** HTML 구조 분석 결과 */
export interface HtmlStructure {
  items: any[];
  isPopular: boolean;
  uniqueGroupsSize: number;
  topicNamesArray: string[];
}

/** 크롤링 캐시 맵들 */
export interface CrawlCaches {
  crawlCache: Map<string, string>;
  itemsCache: Map<string, any[]>;
  matchQueueMap: Map<string, ExposureResult[]>;
  htmlStructureCache: Map<string, {
    isPopular: boolean;
    uniqueGroups: number;
    topicNames: string[];
  }>;
  /** 비로그인 재시도에서 이미 추가된 포스트 링크 (중복 방지) */
  guestAddedLinksCache: Map<string, Set<string>>;
  /** 이미 노출 성공으로 사용된 포스트 링크 (같은 키워드 중복 방지) */
  usedLinksCache: Map<string, Set<string>>;
}

/** 매칭 결과 정보 */
export interface MatchResult {
  nextMatch: ExposureResult;
  extractedVendor: string;
  matchSource: 'VENDOR' | 'TITLE' | '';
  vendorMatchDetails?: VendorMatchDetails;
  allMatchesCount: number;
  remainingQueueCount: number;
}

/** getCrawlResult 파라미터 */
export interface CrawlParams {
  searchQuery: string;
  keywordDoc: KeywordDoc;
  query: string;
  keywordType: KeywordType;
  processing: ProcessingContext;
  caches: CrawlCaches;
}

/** handleExcluded 파라미터 */
export interface ExcludedParams {
  keyword: KeywordContext;
  company: string;
  processing: ProcessingContext;
  updateFunction: UpdateFunction;
  isNewLogic: boolean;
}

/** handleQueueEmpty 파라미터 */
export interface QueueEmptyParams {
  keyword: KeywordContext;
  html: HtmlStructure;
  processing: ProcessingContext;
  updateFunction: UpdateFunction;
}

/** handleSuccess 파라미터 */
export interface SuccessParams {
  keyword: KeywordContext;
  html: HtmlStructure;
  match: MatchResult;
  processing: ProcessingContext;
  allResults: ExposureResult[];
  updateFunction: UpdateFunction;
  guestRetryComparison?: GuestRetryComparison;
}

/** handleFilterFailure 파라미터 */
export interface FilterFailureParams {
  keyword: KeywordContext;
  html: HtmlStructure;
  allMatchesCount: number;
  remainingQueueCount: number;
  processing: ProcessingContext;
  updateFunction: UpdateFunction;
  guestRetryComparison?: GuestRetryComparison;
}
