export interface ExposureResult {
  query: string;
  blogId: string;
  blogName: string;
  postTitle: string;
  postLink: string;
  exposureType: string;
  topicName: string;
  position: number;
  positionWithCafe?: number;
  isNewLogic?: boolean;
  page?: number;
}

export interface DetailedMatch {
  match: ExposureResult;
  postVendorName?: string;
}

export interface TestResult {
  ok: boolean;
  query: string;
  baseKeyword: string;
  restaurantName: string;
  matches: DetailedMatch[];
}

export interface BatchItemResult {
  ok: boolean;
  keyword: string;
  restaurantName: string;
  topic: string;
  rank: number | null;
  blogId: string;
  blogName: string;
  postTitle: string;
  postLink: string;
  postVendorName: string;
  reason?: string;
}

export interface BatchResponse {
  ok: boolean;
  total: number;
  processed: BatchItemResult[];
  error?: string;
}

export interface HealthResponse {
  ok: boolean;
}
