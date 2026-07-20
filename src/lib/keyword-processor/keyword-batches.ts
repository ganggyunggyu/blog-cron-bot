export const chunkByItemBudget = <T>(
  items: readonly T[],
  itemBudget: number,
  getItemSize: (item: T) => number
): T[][] => {
  if (!Number.isInteger(itemBudget) || itemBudget < 1) {
    throw new Error('itemBudget must be a positive integer');
  }

  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentSize = 0;

  for (const item of items) {
    const itemSize = getItemSize(item);
    if (!Number.isInteger(itemSize) || itemSize < 1) {
      throw new Error('item size must be a positive integer');
    }

    if (currentBatch.length > 0 && currentSize + itemSize > itemBudget) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(item);
    currentSize += itemSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};
