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

const buildKeywordGroups = (
  keywords: readonly PageShardKeyword[]
): KeywordGroup[] => {
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

  return groups;
};

export const buildPageKeywordShards = (
  keywords: readonly PageShardKeyword[],
  shardSize: number
): string[][] => {
  const groups = buildKeywordGroups(keywords);
  return chunkByItemBudget(groups, shardSize, (group) => group.ids.length).map(
    (batch) => batch.flatMap((group) => group.ids)
  );
};

export const buildBalancedPageKeywordShards = (
  keywords: readonly PageShardKeyword[],
  requestedShardCount: number,
  maxShardSize: number
): string[][] => {
  if (!Number.isInteger(requestedShardCount) || requestedShardCount <= 0) {
    throw new Error('requestedShardCount must be a positive integer');
  }
  if (!Number.isInteger(maxShardSize) || maxShardSize <= 0) {
    throw new Error('maxShardSize must be a positive integer');
  }

  const groups = buildKeywordGroups(keywords);
  const shardCount = Math.min(requestedShardCount, groups.length);
  const shards: string[][] = [];
  let currentShard: string[] = [];
  const baseShardSize = Math.floor(keywords.length / shardCount);
  const largerShardCount = keywords.length % shardCount;

  groups.forEach((group, index) => {
    const targetSize =
      baseShardSize + (shards.length < largerShardCount ? 1 : 0);
    const exceedsIdealSize =
      currentShard.length > 0 && currentShard.length + group.ids.length > targetSize;
    const exceedsMaxSize =
      currentShard.length > 0 &&
      currentShard.length + group.ids.length > maxShardSize;

    if (
      (exceedsIdealSize || exceedsMaxSize) &&
      shards.length < shardCount - 1
    ) {
      shards.push(currentShard);
      currentShard = [];
    }

    currentShard.push(...group.ids);

    if (index === groups.length - 1) shards.push(currentShard);
  });

  return shards;
};
