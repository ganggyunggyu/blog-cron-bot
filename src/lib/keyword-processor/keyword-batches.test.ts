import assert from 'node:assert/strict';
import { chunkByItemBudget } from './keyword-batches';

interface TestGroup {
  id: string;
  rowCount: number;
}

const groups: TestGroup[] = [
  { id: 'a', rowCount: 30 },
  { id: 'b', rowCount: 20 },
  { id: 'c', rowCount: 40 },
  { id: 'd', rowCount: 10 },
  { id: 'e', rowCount: 1 },
];

const batches = chunkByItemBudget(groups, 50, (group) => group.rowCount);

assert.deepEqual(
  batches.map((batch) => batch.map((group) => group.id)),
  [
    ['a', 'b'],
    ['c', 'd'],
    ['e'],
  ]
);
assert.deepEqual(
  batches.flat().map((group) => group.id),
  groups.map((group) => group.id)
);
assert.deepEqual(
  chunkByItemBudget([{ id: 'oversized', rowCount: 51 }], 50, (group) =>
    group.rowCount
  ),
  [[{ id: 'oversized', rowCount: 51 }]]
);
assert.deepEqual(chunkByItemBudget([], 50, () => 1), []);
assert.throws(() => chunkByItemBudget(groups, 0, () => 1));

process.stdout.write('keyword batch tests passed\n');
