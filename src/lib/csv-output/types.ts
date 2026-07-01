export type KeywordInfo = {
  keyword: string;
  company: string;
};

export type KeywordLogicRow = {
  keyword: string;
  postType: string;
  isNewLogic: boolean;
};

export type CafeExposureCsvRow = {
  keyword: string;
  exposureStatus: string;
  rank: string;
  cafeName: string;
  link: string;
  viewCount: string;
  writeDate: string;
};

export type BlogShareSummaryCsvRow = {
  rank: number;
  blogId: string;
  blogName: string;
  keywordCount: number;
  exposureCount: number;
  bestPosition: number;
  keywords: string[];
};

export type BlogShareDetailCsvRow = {
  keyword: string;
  blogId: string;
  blogName: string;
  postTitle: string;
  postLink: string;
  exposureType: string;
  topicName: string;
  position: number;
  isNewLogic: boolean;
};
