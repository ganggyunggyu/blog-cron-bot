import { useQuery } from '@tanstack/react-query';
import { getJobList } from '../../api/job-api';

export const useJobList = () =>
  useQuery({
    queryKey: ['jobs'],
    queryFn: getJobList,
    refetchInterval: 5000,
  });
