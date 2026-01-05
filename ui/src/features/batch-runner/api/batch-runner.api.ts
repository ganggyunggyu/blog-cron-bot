import { postJson } from '@/shared/api/http';
import type { BatchResponse } from '@/shared/api/types';

interface BatchRunRequest {
  startIndex: number;
  limit: number;
  onlySheetType: string;
  onlyCompany: string;
  onlyKeywordRegex: string;
  onlyId: string;
  onlyIds: string[];
  allowAnyBlog: boolean;
  maxContentChecks: number;
  contentCheckDelay: number;
}

export const requestBatchRun = async (
  baseUrl: string,
  payload: BatchRunRequest
) => {
  return postJson<BatchResponse>('/api/run', payload, baseUrl);
};
