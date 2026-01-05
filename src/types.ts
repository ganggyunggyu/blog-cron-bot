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
  positionWithCafe?: number;
  topicName: string;
  exposureType: string;
  extractedVendor: string;
}

export interface GuestRetryComparison {
  attempted: boolean;
  recovered: boolean;
  loginTopics: string[];
  guestTopics: string[];
  onlyInLogin: string[];
  onlyInGuest: string[];
  commonTopics: string[];
  loginMatchCount: number;
  guestMatchCount: number;
  newMatchCount: number;
  newPosts?: {
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
