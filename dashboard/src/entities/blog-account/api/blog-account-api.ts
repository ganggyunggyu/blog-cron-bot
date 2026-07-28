import { api } from '@/shared';
import type { BlogAccountList, MutateBlogAccountInput } from '../model/types';

export const getBlogAccountLists = async () => {
  const { data } = await api.get<{ lists: BlogAccountList[] }>('/accounts');
  return data.lists;
};

export const mutateBlogAccount = async (input: MutateBlogAccountInput) => {
  const { data } = await api.post<{ lists: BlogAccountList[] }>('/accounts', input);
  return data.lists;
};
