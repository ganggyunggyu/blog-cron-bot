import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePreset } from '../../api/preset-api';
import type { TenantPreset } from '../../model/types';
import { PRESET_QUERY_KEY } from '../use-preset';

export const useSavePreset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preset: TenantPreset) => updatePreset(preset),
    onSuccess: (response) => {
      queryClient.setQueryData(PRESET_QUERY_KEY, response);
    },
  });
};
