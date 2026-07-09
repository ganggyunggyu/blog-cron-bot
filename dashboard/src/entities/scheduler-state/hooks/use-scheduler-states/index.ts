import { useQuery } from '@tanstack/react-query';
import { getSchedulerStateList } from '../../api/scheduler-state-api';

export const useSchedulerStates = () =>
  useQuery({
    queryKey: ['scheduler-state'],
    queryFn: getSchedulerStateList,
    refetchInterval: 60000,
  });
