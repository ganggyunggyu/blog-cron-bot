export interface VendorMatchDetails {
  restaurantName: string;
  baseBrand: string;
  brandRoot: string;
  extractedVendor: string;
  matchedBy: 'rnNorm' | 'baseBrandNorm' | 'brandRoot';
  checkIndex: number;
  rnNorm: string;
  baseBrandNorm: string;
}

export interface TitleMatchDetails {
  tokensUsed: string[];
  tokensRequired: number;
}

export interface MatchedPostInfo {
  blogName: string;
  blogId: string;
  postTitle: string;
  postLink: string;
  position: number;
  positionWithCafe?: number; // 인기글인 경우 카페 포함 순위
  topicName: string;
  exposureType: string;
  extractedVendor: string;
}

/** 비로그인 재시도 비교 정보 */
export interface GuestRetryComparison {
  attempted: boolean; // 비로그인 재시도 시도 여부
  recovered: boolean; // 비로그인으로 노출 복구 성공 여부
  loginTopics: string[]; // 로그인 상태 인기주제
  guestTopics: string[]; // 비로그인 상태 인기주제
  onlyInLogin: string[]; // 로그인에만 있는 주제
  onlyInGuest: string[]; // 비로그인에만 있는 주제
  commonTopics: string[]; // 공통 주제
  loginMatchCount: number; // 로그인 매칭 수
  guestMatchCount: number; // 비로그인 매칭 수
  newMatchCount: number; // 신규 매칭 수 (비로그인 전용)
  newPosts?: { // 비로그인 전용 포스트
    blogName: string;
    postTitle: string;
    topicName: string;
  }[];
}

export interface DetailedLog {
  index: number;
  keyword: string;
  searchQuery: string;
  restaurantName: string;
  vendorTarget: string;
  success: boolean;
  matchSource?: 'VENDOR' | 'TITLE';
  totalItemsParsed: number;
  htmlStructure: {
    isPopular: boolean;
    uniqueGroups: number;
    topicNames: string[];
  };
  allMatchesCount: number;
  availableMatchesCount: number;
  matchedPost?: MatchedPostInfo;
  vendorMatchDetails?: VendorMatchDetails;
  titleMatchDetails?: TitleMatchDetails;
  guestRetryComparison?: GuestRetryComparison;
  failureReason?: string;
  timestamp: string;
  processingTime: number;
}

export interface Config {
  maxRetries: number;
  delayBetweenQueries: number;
}
