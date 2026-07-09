import { api } from '@/shared';
import type { SchedulerStateInfo } from '../model/types';

export const getSchedulerStateList = async () => {
  const { data } = await api.get<{ schedulers: SchedulerStateInfo[] }>('/scheduler-state');
  return data.schedulers;
};
