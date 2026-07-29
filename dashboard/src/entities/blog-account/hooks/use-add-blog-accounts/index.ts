import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addBlogAccounts } from '../../api/blog-account-api';
import type { AddBlogAccountsInput } from '../../model/types';

export const useAddBlogAccounts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddBlogAccountsInput) => addBlogAccounts(input),
    onSuccess: (lists) => {
      queryClient.setQueryData(['blog-accounts'], lists);
    },
  });
};
