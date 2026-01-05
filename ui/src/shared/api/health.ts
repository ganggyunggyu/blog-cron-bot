import { getJson } from '@/shared/api/http';
import type { HealthResponse } from '@/shared/api/types';

export const getHealth = async (baseUrl: string) => {
  return getJson<HealthResponse>('/health', baseUrl);
};
