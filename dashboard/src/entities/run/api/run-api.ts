import { api } from '@/shared';
import type { RunSummary } from '../model/types';

export const getRunList = async () => {
  const { data } = await api.get<{ runs: RunSummary[] }>('/runs');
  return data.runs;
};

export const stopRun = async (runId: string) => {
  const { data } = await api.post<{ ok: boolean }>(`/runs/${runId}/stop`);
  return data;
};
