import { useQuery } from '@tanstack/react-query';
import { getRunList } from '../../api/run-api';

export const useRunList = () =>
  useQuery({
    queryKey: ['runs'],
    queryFn: getRunList,
    refetchInterval: 3000,
  });
