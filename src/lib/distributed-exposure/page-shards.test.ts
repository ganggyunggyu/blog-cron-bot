import assert from 'node:assert/strict';
import { buildPageKeywordShards } from './page-shards';

const uniqueKeywords = Array.from({ length: 120 }, (_, index) => ({
  _id: `id-${index}`,
  keyword: `키워드 ${index}`,
}));
const uniqueShards = buildPageKeywordShards(uniqueKeywords, 50);
assert.deepEqual(uniqueShards.map((shard) => shard.length), [50, 50, 20]);
assert.equal(new Set(uniqueShards.flat()).size, 120);

const duplicateQueryKeywords = [
  ...Array.from({ length: 49 }, (_, index) => ({
    _id: `before-${index}`,
    keyword: `앞-${index}`,
  })),
  { _id: 'same-a', keyword: '같은 검색어' },
  { _id: 'same-b', keyword: '같은 검색어' },
];
const duplicateShards = buildPageKeywordShards(duplicateQueryKeywords, 50);
assert.deepEqual(duplicateShards.map((shard) => shard.length), [49, 2]);
assert.deepEqual(duplicateShards[1], ['same-a', 'same-b']);

assert.throws(
  () => buildPageKeywordShards(uniqueKeywords, 0),
  /positive integer/
);

console.log('page-shards tests passed');
