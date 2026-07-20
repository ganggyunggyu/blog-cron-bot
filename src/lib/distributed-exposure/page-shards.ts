import { getSearchQuery } from '../../utils';
import { chunkByItemBudget } from '../keyword-processor/keyword-batches';

export interface PageShardKeyword {
  _id: unknown;
  keyword: string;
}

interface KeywordGroup {
  query: string;
  ids: string[];
}

export const buildPageKeywordShards = (
  keywords: readonly PageShardKeyword[],
  shardSize: number
): string[][] => {
  const groups: KeywordGroup[] = [];
  const byQuery = new Map<string, KeywordGroup>();

  keywords.forEach((keyword) => {
    const query = getSearchQuery(keyword.keyword || '');
    const existing = byQuery.get(query);
    if (existing) {
      existing.ids.push(String(keyword._id));
      return;
    }
    const group = { query, ids: [String(keyword._id)] };
    byQuery.set(query, group);
    groups.push(group);
  });

  return chunkByItemBudget(groups, shardSize, (group) => group.ids.length).map(
    (batch) => batch.flatMap((group) => group.ids)
  );
};
