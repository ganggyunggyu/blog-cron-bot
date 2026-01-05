import { postJson } from '@/shared/api/http';
import type { TestResult } from '@/shared/api/types';

interface TestKeywordRequest {
  keyword: string;
  allowAnyBlog: boolean;
  fetchHtml: boolean;
  maxContentChecks?: number;
  contentCheckDelay?: number;
}

export const requestTestKeyword = async (
  baseUrl: string,
  payload: TestKeywordRequest
) => {
  return postJson<TestResult>('/api/test', payload, baseUrl);
};
