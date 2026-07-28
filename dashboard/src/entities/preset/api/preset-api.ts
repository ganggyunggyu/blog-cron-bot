import { api } from '@/shared';
import type { PresetResponse, TenantPreset } from '../model/types';

export const getPreset = async () => {
  const { data } = await api.get<PresetResponse>('/preset');
  return data;
};

export const updatePreset = async (preset: TenantPreset) => {
  const { data } = await api.put<PresetResponse>('/preset', { preset });
  return data;
};
