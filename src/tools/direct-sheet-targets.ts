export const DIRECT_SHEET_TARGETS = [
  'package',
  'dogmaru-exclude',
  'dogmaru',
  'seoripet',
] as const;

export type DirectSheetTarget = (typeof DIRECT_SHEET_TARGETS)[number];

const normalizeDirectSheetTarget = (
  value: string
): DirectSheetTarget | null => {
  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'package') return 'package';
  if (normalized === 'dogmaru-exclude' || normalized === 'general') {
    return 'dogmaru-exclude';
  }
  if (normalized === 'dogmaru') return 'dogmaru';
  if (
    normalized === 'seoripet' ||
    normalized === '서리펫' ||
    normalized === 'suripet'
  ) {
    return 'seoripet';
  }

  return null;
};

export const parseDirectSheetTargets = (raw: string): DirectSheetTarget[] => {
  const rawTargets = raw.split(',').map((value) => value.trim());

  if (rawTargets.some((value) => value.toLowerCase() === 'root')) {
    throw new Error('루트 직접병렬 실행은 금지됨. pnpm cron:root를 사용해야 함');
  }

  const targets = rawTargets
    .map((value) => normalizeDirectSheetTarget(value))
    .filter((value): value is DirectSheetTarget => value !== null);

  if (targets.length === 0) {
    throw new Error(`유효한 target이 없음: ${raw}`);
  }

  return Array.from(new Set(targets));
};
