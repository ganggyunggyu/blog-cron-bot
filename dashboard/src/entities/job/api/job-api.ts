import axios from 'axios';
import { api } from '@/shared';
import type { JobListResult, RunJobOptions } from '../model/types';

interface ErrorResponse {
  error?: string;
}

export const getJobList = async (): Promise<JobListResult> => {
  const { data } = await api.get<JobListResult>('/jobs');
  return { jobs: data.jobs ?? [], bundles: data.bundles ?? [] };
};

export const runJob = async (jobId: string, options?: RunJobOptions) => {
  try {
    const { data } = await api.post<{ runId: string }>(`/jobs/${jobId}/run`, options);
    return data;
  } catch (error) {
    if (axios.isAxiosError<ErrorResponse>(error)) {
      throw new Error(error.response?.data.error ?? '실행 요청이 실패함');
    }
    throw error;
  }
};
