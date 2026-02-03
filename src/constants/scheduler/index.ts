export const SCHEDULER_TIME_ZONE = 'Asia/Seoul' as const;

export const KEYWORD_HEADER_SELECTOR = '.fds-comps-header-headline';

export const SEARCH_PARTIAL_SELECTORS = [
  '.fds-comps-text',
  '.fds-ugc-single-intention-item-list',
  '.sds-comps-text-type-headline1',
];

export const WORKFLOW_RUN_TIME_LIST = ['13:02'] as const;

export const ROOT_RUN_TIME_LIST = ['13:03'] as const;

export const SCHEDULER_TICK_INTERVAL_MS = 15_000;

export const SCHEDULER_STATE_FILE = '.scheduler-state.json';

export const ROOT_SCHEDULER_STATE_FILE = '.scheduler-state.root.json';

export const normalizeTimeHHmm = (value: string): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const [hourRaw, minuteRaw] = raw.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  const hourStr = String(hour).padStart(2, '0');
  const minuteStr = String(minute).padStart(2, '0');
  return `${hourStr}:${minuteStr}`;
};

export const parseTimeList = (value: string): string[] => {
  const raw = String(value ?? '').trim();
  if (!raw) return [];

  const tokenList = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const normalizedList: string[] = [];
  for (const token of tokenList) {
    const normalized = normalizeTimeHHmm(token);
    if (!normalized) continue;
    if (normalizedList.includes(normalized)) continue;
    normalizedList.push(normalized);
  }
  return normalizedList;
};
