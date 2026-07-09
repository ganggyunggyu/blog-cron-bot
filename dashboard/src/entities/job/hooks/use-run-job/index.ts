import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runJob } from '../../api/job-api';

export const useRunJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => runJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
};
