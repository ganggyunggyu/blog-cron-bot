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
  failureReason?: string;
  timestamp: string;
  processingTime: number;
}

export interface Config {
  maxRetries: number;
  delayBetweenQueries: number;
}
