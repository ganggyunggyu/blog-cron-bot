import { useQuery } from '@tanstack/react-query';
import { getDaemonStatusList } from '../../api/pm2-process-api';

export const useDaemonStatusList = () =>
  useQuery({
    queryKey: ['pm2', 'daemons'],
    queryFn: getDaemonStatusList,
    refetchInterval: 5000,
  });
