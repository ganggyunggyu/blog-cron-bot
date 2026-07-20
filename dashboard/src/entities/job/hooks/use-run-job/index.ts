import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runJob } from '../../api/job-api';
import type { RunJobInput } from '../../model/types';

export const useRunJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, options }: RunJobInput) => runJob(jobId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};
