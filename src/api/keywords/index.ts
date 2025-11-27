import axios from 'axios';
import {
  SHEET_APP_URL,
  SyncRequest,
  ImportRequest,
} from '../../constants';

interface SyncResponse {
  success: boolean;
  [key: string]: any;
}

interface ImportResponse {
  updated?: number;
  [key: string]: any;
}

export const syncKeywords = async (request: SyncRequest): Promise<SyncResponse> => {
  const response = await axios.post(`${SHEET_APP_URL}/api/keywords/sync`, request);
  return response.data;
};

export const importKeywords = async (request: ImportRequest): Promise<ImportResponse> => {
  const response = await axios.post(`${SHEET_APP_URL}/api/keywords/import`, request);
  return response.data;
};

export const syncAllKeywords = async (
  requests: SyncRequest[]
): Promise<SyncResponse[]> => {
  const results: SyncResponse[] = [];
  for (const request of requests) {
    const response = await syncKeywords(request);
    results.push(response);
  }
  return results;
};

export const importAllKeywords = async (
  requests: ImportRequest[]
): Promise<ImportResponse[]> => {
  const results: ImportResponse[] = [];
  for (const request of requests) {
    const response = await importKeywords(request);
    results.push(response);
  }
  return results;
};

export { SyncRequest, ImportRequest } from '../../constants';
export type { SyncResponse, ImportResponse };
