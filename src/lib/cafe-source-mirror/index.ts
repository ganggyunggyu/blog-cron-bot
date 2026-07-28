export interface CafeSourceMirrorRow {
  rawKeyword: string;
  keyword: string;
  cafeAccount: string;
}

const cellText = (value: unknown): string => String(value ?? '');
const normalizedText = (value: unknown): string => cellText(value).trim();

const buildAccountQueues = (targetValues: readonly unknown[][]): Map<string, string[]> => {
  const queues = new Map<string, string[]>();
  targetValues.slice(1).forEach((row) => {
    const keyword = normalizedText(row[0]);
    if (!keyword) return;
    const accounts = queues.get(keyword) ?? [];
    accounts.push(cellText(row[5]));
    queues.set(keyword, accounts);
  });
  return queues;
};

export const buildCafeSourceMirrorRows = (
  sourceValues: readonly unknown[][],
  targetValues: readonly unknown[][]
): CafeSourceMirrorRow[] => {
  const sourceRows = sourceValues.slice(1);
  let lastSourceIndex = -1;
  sourceRows.forEach((row, index) => {
    if (normalizedText(row[0]) || normalizedText(row[1])) lastSourceIndex = index;
  });
  if (lastSourceIndex < 0) return [];

  const accountQueues = buildAccountQueues(targetValues);
  return sourceRows.slice(0, lastSourceIndex + 1).map((row) => {
    const rawKeyword = cellText(row[1]);
    const keyword = rawKeyword.trim();
    const accountQueue = accountQueues.get(keyword);
    return {
      rawKeyword,
      keyword,
      cafeAccount: keyword && accountQueue ? accountQueue.shift() ?? '' : '',
    };
  });
};

