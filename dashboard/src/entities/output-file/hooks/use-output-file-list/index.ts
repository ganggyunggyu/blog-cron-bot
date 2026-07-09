import { useQuery } from '@tanstack/react-query';
import { getOutputFileList } from '../../api/output-file-api';

export const useOutputFileList = () =>
  useQuery({
    queryKey: ['outputs'],
    queryFn: getOutputFileList,
    refetchInterval: 10000,
  });
