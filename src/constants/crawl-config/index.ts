// ============================================================
// 크롤링 설정 상수
// ============================================================

// 기본 URL
export const NAVER_SEARCH_BASE_URL = 'https://search.naver.com/search.naver';
export const NAVER_REFERER_URL = 'https://www.naver.com/';

// 헤더 생성 옵션
export const HEADER_GENERATOR_OPTIONS = {
  browsers: ['chrome'] as const,
  devices: ['desktop'] as const,
  operatingSystems: ['windows'] as const,
  locales: ['ko-KR'] as const,
} as const;

// ackey 생성용
export const ACKEY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const ACKEY_LENGTH = 8;

// 타임아웃 설정 (ms)
export const TIMEOUT = {
  /** 페이지 로드 타임아웃 */
  PAGE_LOAD: 30000,
  /** 셀렉터 대기 타임아웃 */
  SELECTOR_WAIT: 10000,
  /** HTTP 요청 타임아웃 */
  REQUEST: 30000,
} as const;

// 딜레이 설정 (ms)
export const DELAY = {
  /** 콘텐츠 로드 후 기본 대기 */
  CONTENT_LOAD_BASE: 1500,
  /** 콘텐츠 로드 후 랜덤 추가 대기 (0 ~ 값) */
  CONTENT_LOAD_RANDOM: 1000,
  /** 페이지 간 이동 기본 대기 */
  PAGE_NAVIGATION_BASE: 1500,
  /** 페이지 간 이동 랜덤 추가 대기 */
  PAGE_NAVIGATION_RANDOM: 1500,
  /** VIEW 탭 페이지 간 기본 대기 */
  VIEW_TAB_BASE: 300,
  /** VIEW 탭 페이지 간 랜덤 추가 대기 */
  VIEW_TAB_RANDOM: 500,
  /** 버튼 클릭 후 대기 */
  BUTTON_CLICK: 2000,
  /** 차단 감지 시 대기 */
  BLOCKED_WAIT: 5000,
  /** 쿼리 간 대기 */
  BETWEEN_QUERIES: 1500,
  /** 멀티페이지 크롤링 페이지 간 최소 대기 */
  MULTI_PAGE_MIN: 500,
  /** 멀티페이지 크롤링 페이지 간 최대 대기 */
  MULTI_PAGE_MAX: 1000,
  /** 재시도 시 랜덤 지터 최대값 */
  RETRY_JITTER_MAX: 1000,
} as const;

// 재시도 설정
export const RETRY = {
  /** 최대 재시도 횟수 */
  MAX_RETRIES: 5,
  /** 로그인 크롤링 기본 재시도 횟수 */
  DEFAULT_LOGIN_RETRIES: 3,
  /** 비로그인 크롤링 기본 재시도 횟수 */
  DEFAULT_GUEST_RETRIES: 2,
  /** 403 에러 시 기본 대기 (ms) */
  DELAY_ON_403: 60000,
  /** 일반 에러 시 기본 대기 (ms) */
  DELAY_ON_ERROR: 30000,
} as const;

// 페이지네이션 설정
export const PAGINATION = {
  /** 기본 최대 페이지 수 */
  DEFAULT_MAX_PAGES: 4,
  /** VIEW 탭 페이지당 결과 수 */
  VIEW_TAB_RESULTS_PER_PAGE: 30,
} as const;

// DOM 셀렉터
export const SELECTORS = {
  /** 메인 콘텐츠 영역 */
  MAIN_PACK: '#main_pack',
  /** 페이지 버튼 컨테이너 */
  PAGE_BUTTON_CONTAINER: '.sc_page_inner a.btn',
  /** 제한 해제 버튼 */
  RELEASE_BUTTON: 'button.btn_open:has-text("제한 해제")',
} as const;

// 차단 감지 문자열
export const BLOCKED_INDICATORS = [
  '검색 서비스 이용이 제한되었습니다',
  '비정상적인 검색',
] as const;

// 콘텐츠 체크 설정
export const CONTENT_CHECK = {
  /** 최대 콘텐츠 체크 횟수 */
  MAX_CHECKS: 3,
  /** 체크 간 딜레이 (ms) */
  DELAY_MS: 100,
} as const;

// ============================================================
// 헬퍼 함수
// ============================================================

/** 랜덤 딜레이 계산 */
export const getRandomDelay = (base: number, random: number): number =>
  base + Math.random() * random;

/** 콘텐츠 로드 대기 시간 */
export const getContentLoadDelay = (): number =>
  getRandomDelay(DELAY.CONTENT_LOAD_BASE, DELAY.CONTENT_LOAD_RANDOM);

/** 페이지 이동 대기 시간 */
export const getPageNavigationDelay = (): number =>
  getRandomDelay(DELAY.PAGE_NAVIGATION_BASE, DELAY.PAGE_NAVIGATION_RANDOM);

/** VIEW 탭 페이지 대기 시간 */
export const getViewTabDelay = (): number =>
  getRandomDelay(DELAY.VIEW_TAB_BASE, DELAY.VIEW_TAB_RANDOM);

// ============================================================
// URL 빌더
// ============================================================

/** 통합검색 URL 생성 */
export const buildNaverSearchUrl = (
  query: string,
  page: number = 1
): string => {
  const encodedQuery = encodeURIComponent(query);
  if (page <= 1) {
    return `${NAVER_SEARCH_BASE_URL}?where=nexearch&query=${encodedQuery}`;
  }
  return `${NAVER_SEARCH_BASE_URL}?nso=&page=${page}&query=${encodedQuery}&sm=tab_pge&ssc=tab.ur.all&start=1`;
};

/** VIEW 탭 URL 생성 */
export const buildViewTabUrl = (query: string, page: number = 1): string => {
  const encodedQuery = encodeURIComponent(query);
  const start = (page - 1) * PAGINATION.VIEW_TAB_RESULTS_PER_PAGE + 1;
  return `${NAVER_SEARCH_BASE_URL}?ssc=tab.blog.all&where=blog&query=${encodedQuery}&start=${start}`;
};

// ============================================================
// 레거시 호환 (deprecated)
// ============================================================

/** @deprecated RETRY, DELAY 객체 사용 권장 */
export const CRAWL_CONFIG = {
  maxRetries: RETRY.MAX_RETRIES,
  delayBetweenQueries: DELAY.BETWEEN_QUERIES,
} as const;
