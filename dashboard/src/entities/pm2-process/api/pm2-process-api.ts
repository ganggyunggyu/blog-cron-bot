import { api } from '@/shared';
import type { DaemonAction, DaemonStatus } from '../model/types';

export const getDaemonStatusList = async () => {
  const { data } = await api.get<{ daemons: DaemonStatus[] }>('/pm2');
  return data.daemons;
};

export const runDaemonAction = async (name: string, action: DaemonAction) => {
  const { data } = await api.post<{ ok: boolean }>(`/pm2/${name}/${action}`);
  return data;
};
