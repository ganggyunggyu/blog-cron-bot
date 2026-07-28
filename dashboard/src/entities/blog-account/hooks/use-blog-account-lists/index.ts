import { useQuery } from '@tanstack/react-query';
import { getBlogAccountLists } from '../../api/blog-account-api';

export const useBlogAccountLists = () =>
  useQuery({
    queryKey: ['blog-accounts'],
    queryFn: getBlogAccountLists,
  });
