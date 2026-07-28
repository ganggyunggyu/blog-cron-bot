export type ManagedListId = 'suripet' | 'dogmaru';

export interface BlogAccountList {
  id: ManagedListId;
  label: string;
  description: string;
  seed: string[];
  added: string[];
  removed: string[];
  effective: string[];
}

export interface MutateBlogAccountInput {
  listId: ManagedListId;
  blogId: string;
  action: 'add' | 'remove';
}
