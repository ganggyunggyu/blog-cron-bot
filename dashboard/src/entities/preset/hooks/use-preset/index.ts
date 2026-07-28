import { useQuery } from '@tanstack/react-query';
import { getPreset } from '../../api/preset-api';

export const PRESET_QUERY_KEY = ['preset'] as const;

export const usePreset = () =>
  useQuery({
    queryKey: PRESET_QUERY_KEY,
    queryFn: getPreset,
  });
