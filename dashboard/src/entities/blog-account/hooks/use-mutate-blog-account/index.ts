import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mutateBlogAccount } from '../../api/blog-account-api';
import type { MutateBlogAccountInput } from '../../model/types';

export const useMutateBlogAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MutateBlogAccountInput) => mutateBlogAccount(input),
    onSuccess: (lists) => {
      queryClient.setQueryData(['blog-accounts'], lists);
    },
  });
};
