import { api } from '@/shared';
import type { JobDefinition } from '../model/types';

export const getJobList = async () => {
  const { data } = await api.get<{ jobs: JobDefinition[] }>('/jobs');
  return data.jobs;
};

export const runJob = async (jobId: string) => {
  const { data } = await api.post<{ runId: string }>(`/jobs/${jobId}/run`);
  return data;
};
