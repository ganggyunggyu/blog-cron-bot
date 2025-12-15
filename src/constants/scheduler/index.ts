export const SCHEDULER_TIME_ZONE = 'Asia/Seoul' as const;

/**
 * 네이버 검색 결과에서 키워드 헤더를 찾기 위한 기본 셀렉터
 * 예: "건강·의학 인기글", "IT·컴퓨터 인기글" 등의 카테고리 헤더
 */
export const KEYWORD_HEADER_SELECTOR = '.fds-comps-header-headline';

/**
 * 네이버 검색 결과 파싱 시 Fallback 셀렉터 목록
 *
 * 네이버가 HTML 구조를 자주 변경하기 때문에,
 * 기본 셀렉터로 찾지 못할 경우 순차적으로 시도할 셀렉터들
 */
export const SEARCH_PARTIAL_SELECTORS = [
  '.fds-comps-text',
  '.fds-ugc-single-intention-item-list',
  '.sds-comps-text-type-headline1',
];

export const WORKFLOW_RUN_TIME_LIST = ['09:10'] as const;

export const ROOT_RUN_TIME_LIST = ['08:45'] as const;

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
