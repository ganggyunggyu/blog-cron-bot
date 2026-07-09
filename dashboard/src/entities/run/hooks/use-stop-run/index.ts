import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stopRun } from '../../api/run-api';

export const useStopRun = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => stopRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
};
