import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { BrowserContext, Page } from 'playwright';
import { fetchHtml, buildNaverSearchUrl, randomDelay } from '../crawler';
import {
  BLOG_IDS,
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
  SURI_PET_PAGE_CHECK_BLOG_IDS,
  TEST_CONFIG,
  EXPOSURE_SHEET_LOCATIONS,
} from '../constants';
import {
  findHeaderRowIndex,
  getGoogleSheetAuth,
  openSpreadsheet,
} from '../lib/google-sheets/direct-exposure-sheet';
import { findMatchingPost } from '../lib/post-filter';
import { closeBrowser, launchBrowser } from '../lib/playwright-crawler';
import {
  BlogItem,
  extractAllBlogLinks,
} from '../lib/playwright-crawler/blog-extractor';
import { logger } from '../lib/logger';
import { emitExposureProgress } from '../lib/exposure-progress';
import { resolveNaverSearchResultUrl } from '../lib/naver-source';
import { ExposureResult } from '../matcher';

dotenv.config();

type SourceTab =
  | '패키지'
  | '일반건'
  | '도그마루'
  | '서리펫'
  | '루트'
  | '흑염소 구'
  | '애견'
  | '시트';

interface CliOptions {
  sheetId: string;
  outputGid: number;
  outputTitle: string;
  inputGid: number | null;
  inputTitle: string;
  inputFromOutput: boolean;
  limit: number;
  concurrency: number;
  dryRun: boolean;
  append: boolean;
  partialUpdate: boolean;
  rankOnly: boolean;
  allMatches: boolean;
  externalBlogLimit: number;
  useCheckpoint: boolean;
  inputExposedOnly: boolean;
  maxMorePages: number;
  maxScrolls: number;
  maxResults: number;
  stableScrolls: number;
  mode: 'browser' | 'hybrid' | 'api';
  sourceTabs: SourceTab[];
  targetBlogIds: string[];
  targetBlogIdsOverridden: boolean;
  keywordFilters: string[];
}

interface SourceKeywordRow {
  sourceTab: SourceTab;
  company: string;
  keyword: string;
  rowNumber: number;
}

interface ResolvedKeywordTarget {
  sourceTab: SourceTab;
  targetKey: string;
  outputKeyword: string;
  sourceKeyword: string;
  searchKeyword: string;
  vendorTarget: string;
}

type OutputRow = Array<string | number>;

interface OutputRowGroup {
  keyword: string;
  rows: OutputRow[];
}

interface MorePageItem {
  title: string;
  link: string;
  blogId: string;
  position: number;
}

interface MoreLinkCandidate {
  index: number;
  text: string;
  url: string;
  score: number;
}

interface CheckResult {
  targetKey: string;
  keyword: string;
  searchKeyword: string;
  vendorTarget: string;
  exposed: boolean;
  position: number | '';
  link: string;
  postPublishedAt: string;
  matches: CheckMatch[];
  externalMatches: ExternalBlogMatch[];
  subject: string;
  checkedCount: number;
  scrollCount: number;
  scrollEndReason: string;
  error: string;
}

interface CheckMatch {
  position: number;
  link: string;
  postPublishedAt: string;
}

interface ExternalBlogMatch {
  position: number;
  blogId: string;
  link: string;
  postPublishedAt: string;
}

interface LayerBridgeCollection {
  html?: unknown;
}

interface LayerBridgeResponse {
  dom?: {
    collection?: LayerBridgeCollection[];
    url?: unknown;
  };
}

interface VisibleContentItem {
  type: 'blog' | 'cafe' | 'ad';
  canonical: string;
  title: string;
  link: string;
  blogName: string;
  postPublishedAt: string;
}

interface KeywordSearchTarget {
  searchKeyword: string;
  vendorTarget: string;
}

const DEFAULT_SOURCE_TABS: SourceTab[] = ['패키지', '일반건', '도그마루'];
const OUTPUT_HEADERS = [
  '키워드',
  '블로그아이디',
  '순위',
  '링크',
  '작성일자',
  '상위글1작성일자',
  '상위글2작성일자',
  '상위글3작성일자',
  '상태',
];
const DEFAULT_OUTPUT_GID = 767466946;
const DEFAULT_OUTPUT_TITLE = '0611';
const PAGE_CHECK_SHEET_ID = '1c9TJ1gETtunuCmzfzap-2lyqXj1cwzITOb1k8W4tL8c';
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_MAX_MORE_PAGES = 30;
const DEFAULT_MAX_SCROLLS = 120;
const DEFAULT_MAX_RESULTS = 300;
const DEFAULT_STABLE_SCROLLS = 6;
const API_MIN_CHECKED_COUNT = 3;
const DEFAULT_CHECKPOINT_PATH = path.resolve(
  process.cwd(),
  'output/old-logic-more-checkpoint.json'
);
const SEARCH_SETTLE_WAIT_MS = 2000;
const MORE_LAYER_SETTLE_WAIT_MS = 2500;
const BEFORE_MORE_CLICK_WAIT_MS = 150;
const SCROLL_WAIT_MS = 400;
const MORE_RESULT_ROOT_SELECTOR =
  '.mod_bridge_layer._sfe_layer_bridge_root, ._sfe_layer_bridge_root';
const MIN_SCROLLS_BEFORE_STABLE = 60;
const SMALL_RESULT_MIN_SCROLLS_BEFORE_STABLE = 60;
const MEDIUM_RESULT_MIN_SCROLLS_BEFORE_STABLE = 60;
const MAX_SCROLL_ATTEMPTS = 3;
const MORE_LINK_DISCOVERY_ATTEMPTS = 10;
const MORE_LINK_DISCOVERY_SCROLL_Y = 2200;
const MORE_LINK_DISCOVERY_WAIT_MS = 900;
const FETCH_RETRY_LIMIT = 5;
const DEFAULT_EXTERNAL_BLOG_LIMIT = 0;
const CHECKPOINT_VERSION = 3;
let publishedAtQueue: Promise<void> = Promise.resolve();
const publishedAtCache = new Map<string, Promise<string>>();

const TARGET_BLOG_IDS = [
  '0902ab',
  'by9996',
  'ziniz77',
  'taraswati',
  'vividoasis',
  'yaves0218',
  'idoenzang',
  'an970405',
  'solantoro',
  'surreal805',
  'busansmart',
  'dnation09',
  'dreamclock33',
  'sarangchai_',
  'i_thinkkkk',
  'sw078',
  'seowoo7603',
  'tpeany',
  'hotelelena',
  'yakooroo',
  'wandookong2',
  'sssunz',
  'canopus_72',
  'queen9336',
  'sesrsoa',
  'umle1203',
  'minjin90310',
  'mw_mj',
  'jkr1231',
  'jini79_kr',
  'sweetfam',
  'kwen1030',
  'k54382000',
  'janaggena',
  'durysuk',
  'nanugi99',
  'v3se',
  'sanghoonchoi',
  'managa7766',
  'armour00',
  'sunyzone2',
  'kgshon',
  'olpark4455',
  'introsm',
  'ylk3516',
] as const;

const REMOVED_TARGET_BLOG_IDS: readonly string[] = ['ikc9036'];

const normalizeCell = (value: unknown): string => String(value ?? '').trim();

const normalizeHeader = (value: unknown): string =>
  normalizeCell(value).replace(/\s+/g, '').toLowerCase();

const normalizeBlogId = (value: unknown): string =>
  normalizeCell(value).toLowerCase();

const normalizeVendorTarget = (value: unknown): string => {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map((line) => normalizeCell(line))
    .filter(Boolean);

  return lines[0] ?? '';
};

const parseKeywordSearchTarget = (keyword: string): KeywordSearchTarget => {
  const normalized = normalizeCell(keyword);
  const match = normalized.match(/^(.+?)\s*[\(（]([^()（）]+)[\)）]\s*$/u);

  if (!match) {
    return {
      searchKeyword: normalized,
      vendorTarget: '',
    };
  }

  return {
    searchKeyword: normalizeCell(match[1]),
    vendorTarget: normalizeCell(match[2]),
  };
};

const resolveKeywordTarget = (row: SourceKeywordRow): ResolvedKeywordTarget => {
  const keywordTarget = parseKeywordSearchTarget(row.keyword);
  const shouldUseVendorTarget = row.sourceTab === '루트';
  const vendorTarget = shouldUseVendorTarget
    ? keywordTarget.vendorTarget || normalizeVendorTarget(row.company)
    : '';
  const outputKeyword = row.keyword;
  const targetKey = [
    row.sourceTab,
    keywordTarget.searchKeyword,
    vendorTarget,
  ].join('\u0001');

  return {
    sourceTab: row.sourceTab,
    targetKey,
    outputKeyword,
    sourceKeyword: row.keyword,
    searchKeyword: keywordTarget.searchKeyword,
    vendorTarget,
  };
};

const REMOVED_TARGET_BLOG_ID_SET = new Set(
  REMOVED_TARGET_BLOG_IDS.map((blogId) => blogId.toLowerCase())
);

const dedupeTargetBlogIds = (
  blogIds: readonly string[],
  options: { allowRemoved?: boolean } = {}
): string[] =>
  Array.from(new Set(blogIds.map((blogId) => normalizeBlogId(blogId)))).filter(
    (blogId) =>
      blogId && (options.allowRemoved || !REMOVED_TARGET_BLOG_ID_SET.has(blogId))
  );

const getDefaultTargetBlogIdsForSource = (sourceTab: SourceTab): string[] => {
  if (sourceTab === '도그마루' || sourceTab === '애견') {
    return dedupeTargetBlogIds(DOGMARU_PAGE_CHECK_BLOG_IDS);
  }

  if (sourceTab === '서리펫') {
    return dedupeTargetBlogIds(SURI_PET_PAGE_CHECK_BLOG_IDS);
  }

  if (sourceTab === '패키지' || sourceTab === '일반건' || sourceTab === '시트') {
    return dedupeTargetBlogIds(PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS, {
      allowRemoved: true,
    });
  }

  return dedupeTargetBlogIds(TARGET_BLOG_IDS);
};

const getTargetBlogIdsForTarget = (
  target: ResolvedKeywordTarget,
  options: CliOptions
): string[] =>
  options.targetBlogIdsOverridden
    ? dedupeTargetBlogIds(options.targetBlogIds, { allowRemoved: true })
    : getDefaultTargetBlogIdsForSource(target.sourceTab);

const describeTargetBlogIds = (options: CliOptions): string => {
  if (options.targetBlogIdsOverridden) {
    return `override ${dedupeTargetBlogIds(options.targetBlogIds, { allowRemoved: true }).length}개`;
  }

  const sourceLabels = Array.from(new Set(options.sourceTabs)).map((sourceTab) => {
    const blogIds = getDefaultTargetBlogIdsForSource(sourceTab);
    const setName =
      sourceTab === '패키지' || sourceTab === '일반건' || sourceTab === '시트'
        ? 'PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS'
        : sourceTab === '도그마루' || sourceTab === '애견'
          ? 'DOGMARU_PAGE_CHECK_BLOG_IDS'
          : sourceTab === '서리펫'
            ? 'SURI_PET_PAGE_CHECK_BLOG_IDS'
          : 'OLD_LOGIC_TARGET_BLOG_IDS';

    return `${sourceTab}:${setName} ${blogIds.length}개`;
  });

  return sourceLabels.join(' / ');
};

const extractBlogIdFromInput = (value: string): string => {
  const normalized = normalizeCell(value);
  const match = normalized.match(/blog\.naver\.com\/([^/?&#]+)/);

  return normalizeBlogId(match?.[1] ?? normalized);
};

const isNewLogicValue = (value: unknown): boolean =>
  ['o', '1', 'true', 'y', 'yes', '신규'].includes(
    normalizeCell(value).toLowerCase()
  );

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const formatKoreanDateTime = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${getPart('year')}. ${Number(getPart('month'))}. ${Number(
    getPart('day')
  )}. ${getPart('hour')}:${getPart('minute')}`;
};

const buildMobilePostUrl = (link: string): string => {
  const parsed = new URL(link);
  const directMatch = parsed.pathname.match(/^\/([^/]+)\/(\d+)/);
  const blogId =
    parsed.searchParams.get('blogId') ?? (directMatch ? directMatch[1] : '');
  const logNo =
    parsed.searchParams.get('logNo') ?? (directMatch ? directMatch[2] : '');

  if (!blogId || !logNo) {
    throw new Error(`블로그 글 링크 형식 확인 실패: ${link}`);
  }

  return `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(
    blogId
  )}&logNo=${encodeURIComponent(logNo)}`;
};

const extractPublishedAtFromHtml = (html: string): string => {
  const $ = cheerio.load(html);
  const selectorCandidates = [
    'p.blog_date',
    '.se_publishDate',
    '.date',
    '[class*="date"]',
  ];

  for (const selector of selectorCandidates) {
    const text = normalizeCell($(selector).first().text()).replace(/\s+/g, ' ');

    if (/\d{4}\.\s*\d{1,2}\.\s*\d{1,2}/.test(text)) {
      return text;
    }
  }

  const bodyText = normalizeCell($.text()).replace(/\s+/g, ' ');
  const textMatch = bodyText.match(
    /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?(?:\s*\d{1,2}:\d{2})?/
  );

  if (textMatch) {
    return textMatch[0].trim();
  }

  const timestampMatch = html.match(/postWriteDate\s*=\s*['"](\d{10,})['"]/);

  if (timestampMatch) {
    return formatKoreanDateTime(new Date(Number(timestampMatch[1])));
  }

  return '';
};

const isExactPublishedAt = (value: string): boolean =>
  /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}/.test(value);

const waitForPublishedAtTurn = async (): Promise<() => void> => {
  const previous = publishedAtQueue;
  let release!: () => void;

  publishedAtQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);
  await randomDelay(250, 600);

  return release;
};

const fetchPostPublishedAtUncached = async (link: string): Promise<string> => {
  const release = await waitForPublishedAtTurn();

  try {
    const mobileUrl = buildMobilePostUrl(link);
    const html = await fetchHtmlWithRetry(mobileUrl, '블로그 작성일');

    return extractPublishedAtFromHtml(html);
  } catch (error) {
    logger.warn(
      `작성일 수집 실패: ${link} (${error instanceof Error ? error.message : String(error)})`
    );
    return '';
  } finally {
    release();
  }
};

const fetchPostPublishedAt = async (link: string): Promise<string> => {
  const cached = publishedAtCache.get(link);

  if (cached) {
    return cached;
  }

  const promise = fetchPostPublishedAtUncached(link);
  publishedAtCache.set(link, promise);

  return promise;
};

const resolvePostPublishedAt = async (
  link: string,
  fallback: string
): Promise<string> => {
  if (fallback && isExactPublishedAt(fallback)) {
    return fallback;
  }

  return (await fetchPostPublishedAt(link)) || fallback;
};

const parseBlogPostFromHref = (
  href: string,
  fallbackUrl = ''
): { canonical: string; link: string; blogName: string } | null => {
  try {
    const resolvedHref = resolveNaverSearchResultUrl(href, fallbackUrl);
    const url = new URL(resolvedHref, 'https://search.naver.com');
    const directMatch = url.pathname.match(/^\/([^/]+)\/(\d+)/);
    const blogId = url.searchParams.get('blogId') ?? directMatch?.[1] ?? '';
    const logNo = url.searchParams.get('logNo') ?? directMatch?.[2] ?? '';

    if (!url.hostname.includes('blog.naver.com') || !blogId || !logNo) {
      return null;
    }

    return {
      canonical: `blog:${blogId.toLowerCase()}/${logNo}`,
      link: `https://blog.naver.com/${blogId}/${logNo}`,
      blogName: blogId,
    };
  } catch {
    return null;
  }
};

const parseInfluencerPostFromHref = (
  href: string,
  fallbackUrl = ''
): { canonical: string; link: string; blogName: string } | null => {
  try {
    const resolvedHref = resolveNaverSearchResultUrl(href, fallbackUrl);
    const url = new URL(resolvedHref, 'https://search.naver.com');

    if (!url.hostname.includes('in.naver.com')) {
      return null;
    }

    const pathSegments = url.pathname.replace(/^\/+/, '').split('/');
    const contentsIndex = pathSegments.indexOf('contents');
    if (contentsIndex < 1) {
      return null;
    }

    const influencerId = pathSegments[0] || '';
    const contentId = pathSegments[contentsIndex + 2] || pathSegments[contentsIndex + 1] || '';

    if (!influencerId || !contentId) {
      return null;
    }

    return {
      canonical: `influencer:${influencerId.toLowerCase()}/${contentId}`,
      link: resolvedHref,
      blogName: influencerId,
    };
  } catch {
    return null;
  }
};

const parseCafePostFromHref = (
  href: string,
  fallbackUrl = ''
): { canonical: string; link: string } | null => {
  try {
    const resolvedHref = resolveNaverSearchResultUrl(href, fallbackUrl);
    const url = new URL(resolvedHref, 'https://search.naver.com');

    if (!url.hostname.includes('cafe.naver.com')) {
      return null;
    }

    const directPathMatch = url.pathname.match(/^\/([^/]+)\/(\d+)/);
    const cafeArticleMatch = url.pathname.match(
      /\/ca-fe\/cafes\/([^/]+)\/articles\/([^/?#]+)/
    );
    const clubId = url.searchParams.get('clubid') ?? cafeArticleMatch?.[1] ?? '';
    const articleId =
      url.searchParams.get('articleid') ??
      url.searchParams.get('articleId') ??
      directPathMatch?.[2] ??
      cafeArticleMatch?.[2] ??
      '';
    const cafeKey = clubId || directPathMatch?.[1] || url.hostname;

    if (!articleId) {
      return null;
    }

    return {
      canonical: `cafe:${cafeKey}:${articleId}`,
      link: url.toString(),
    };
  } catch {
    return null;
  }
};

const parseAdPostFromHref = (
  href: string,
  fallbackUrl = ''
): { canonical: string; link: string } | null => {
  try {
    const resolvedHref = resolveNaverSearchResultUrl(href, fallbackUrl);
    const url = new URL(resolvedHref, 'https://search.naver.com');

    if (
      !url.hostname.includes('ader.naver.com') &&
      !url.hostname.includes('adcr.naver.com')
    ) {
      return null;
    }

    return {
      canonical: `ad:${url.toString()}`,
      link: url.toString(),
    };
  } catch {
    return null;
  }
};

const getMinimumScrollsBeforeStable = (loadedContentCount: number): number => {
  if (loadedContentCount < 20) {
    return SMALL_RESULT_MIN_SCROLLS_BEFORE_STABLE;
  }

  if (loadedContentCount < 100) {
    return MEDIUM_RESULT_MIN_SCROLLS_BEFORE_STABLE;
  }

  return MIN_SCROLLS_BEFORE_STABLE;
};

const isRetryableFetchError = (error: unknown): boolean => {
  const message = getErrorMessage(error);

  return (
    message.includes('HTTP 403') ||
    message.includes('HTTP 429') ||
    message.includes('HTTP 500') ||
    message.includes('HTTP 502') ||
    message.includes('HTTP 503') ||
    message.includes('HTTP 504')
  );
};

const fetchHtmlWithRetry = async (
  url: string,
  label: string,
  retryLimit = FETCH_RETRY_LIMIT
): Promise<string> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
    try {
      return await fetchHtml(url);
    } catch (error) {
      lastError = error;

      if (!isRetryableFetchError(error) || attempt === retryLimit) {
        break;
      }

      const waitMs =
        6000 * attempt + Math.floor(Math.random() * 3000);
      logger.warn(
        `${label} 재시도 ${attempt}/${retryLimit - 1} (${Math.round(
          waitMs / 1000
        )}초 대기): ${getErrorMessage(error)}`
      );
      await randomDelay(waitMs, waitMs + 1000);
    }
  }

  throw lastError;
};

const extractVisibleContentItems = async (
  page: Page,
  rootSelector = ''
): Promise<VisibleContentItem[]> =>
  page.evaluate((selector) => {
    const cleanText = (value: string | null | undefined): string =>
      String(value ?? '').replace(/\s+/g, ' ').trim();
    const getCollectionRoot = (): ParentNode => {
      if (!selector) {
        return document;
      }

      const candidates = Array.from(document.querySelectorAll(selector));
      const visibleCandidate = candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          candidate.querySelectorAll('a[href]').length > 0
        );
      });

      return visibleCandidate ?? candidates[0] ?? document;
    };
    const decodeUrl = (value: string): string => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };
    const getFallbackUrl = (anchor: HTMLAnchorElement): string =>
      cleanText(
        anchor.getAttribute('cru') ||
          anchor.getAttribute('data-url') ||
          anchor.getAttribute('data-cr-url') ||
          anchor.getAttribute('data-link-url') ||
          ''
      );
    const resolveSearchResultHref = (anchor: HTMLAnchorElement): string => {
      const fallbackUrl = getFallbackUrl(anchor);

      if (fallbackUrl) {
        return decodeUrl(fallbackUrl);
      }

      const href = cleanText(anchor.getAttribute('href') || anchor.href);

      if (!href) {
        return '';
      }

      try {
        const url = new URL(href, 'https://search.naver.com');
        const encodedTarget =
          url.searchParams.get('u') ||
          url.searchParams.get('url') ||
          url.searchParams.get('cru');

        return encodedTarget ? decodeUrl(encodedTarget) : url.toString();
      } catch {
        return href;
      }
    };
    const getTitle = (anchor: HTMLAnchorElement): string => {
      const directText = cleanText(anchor.textContent || anchor.title);

      if (directText && !directText.includes('blog.naver.com')) {
        return directText;
      }

      const container = anchor.closest('li, div');
      const titleElement = container?.querySelector(
        '.title_link, .api_txt_lines, .sds-comps-text-type-headline1, .total_tit, .link_tit'
      );

      return cleanText(titleElement?.textContent) || directText;
    };
    const getPublishedAt = (anchor: HTMLAnchorElement): string => {
      let cursor: Element | null = anchor;
      const datePattern =
        /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?(?:\s*\d{1,2}:\d{2})?/;
      const relativePattern =
        /\d+\s*(?:분|시간|일|주|개월|년)\s*전/u;

      for (let depth = 0; depth < 8 && cursor; depth += 1) {
        const subtextElement = cursor.querySelector(
          '.sds-comps-profile-info-subtext, .sub_time, .date, [class*="date"], [class*="time"]'
        );
        const subtext = cleanText(subtextElement?.textContent);
        const subtextDate = subtext.match(datePattern)?.[0];
        if (subtextDate) return cleanText(subtextDate);
        const subtextRelative = subtext.match(relativePattern)?.[0];
        if (subtextRelative) return subtextRelative.replace(/\s+/g, '');

        const text = cleanText(cursor.textContent);
        const date = text.match(datePattern)?.[0];
        if (date) return cleanText(date);
        const relative = text.match(relativePattern)?.[0];
        if (relative) return relative.replace(/\s+/g, '');

        cursor = cursor.parentElement;
      }

      return '';
    };
    const getBlogPost = (
      anchor: HTMLAnchorElement
    ): { canonical: string; link: string; blogName: string } | null => {
      try {
        const href = resolveSearchResultHref(anchor);
        const url = new URL(href);
        const directMatch = url.pathname.match(/^\/([^/]+)\/(\d+)/);
        const blogId = url.searchParams.get('blogId') ?? directMatch?.[1] ?? '';
        const logNo = url.searchParams.get('logNo') ?? directMatch?.[2] ?? '';

        if (!url.hostname.includes('blog.naver.com') || !blogId || !logNo) {
          return null;
        }

        return {
          canonical: `blog:${blogId.toLowerCase()}/${logNo}`,
          link: `https://blog.naver.com/${blogId}/${logNo}`,
          blogName: blogId,
        };
      } catch {
        return null;
      }
    };
    const getInfluencerPost = (
      anchor: HTMLAnchorElement
    ): { canonical: string; link: string; blogName: string } | null => {
      try {
        const href = resolveSearchResultHref(anchor);
        const url = new URL(href);

        if (!url.hostname.includes('in.naver.com')) {
          return null;
        }

        const pathSegments = url.pathname.replace(/^\/+/, '').split('/');
        const contentsIndex = pathSegments.indexOf('contents');
        if (contentsIndex < 1) {
          return null;
        }

        const influencerId = pathSegments[0] || '';
        const contentId =
          pathSegments[contentsIndex + 2] || pathSegments[contentsIndex + 1] || '';

        if (!influencerId || !contentId) {
          return null;
        }

        return {
          canonical: `influencer:${influencerId.toLowerCase()}/${contentId}`,
          link: href,
          blogName: influencerId,
        };
      } catch {
        return null;
      }
    };
    const getCafePost = (
      anchor: HTMLAnchorElement
    ): { canonical: string; link: string } | null => {
      try {
        const href = resolveSearchResultHref(anchor);
        const url = new URL(href);

        if (!url.hostname.includes('cafe.naver.com')) {
          return null;
        }

        const directPathMatch = url.pathname.match(/^\/([^/]+)\/(\d+)/);
        const cafeArticleMatch = url.pathname.match(
          /\/ca-fe\/cafes\/([^/]+)\/articles\/([^/?#]+)/
        );
        const articlePathMatch = url.pathname.match(/\/ArticleRead/);
        const clubId =
          url.searchParams.get('clubid') ?? cafeArticleMatch?.[1] ?? '';
        const articleId =
          url.searchParams.get('articleid') ??
          url.searchParams.get('articleId') ??
          directPathMatch?.[2] ??
          cafeArticleMatch?.[2] ??
          '';
        const cafeKey = clubId || directPathMatch?.[1] || url.hostname;

        if (!articlePathMatch && !articleId) {
          return null;
        }

        return {
          canonical: `cafe:${cafeKey}:${articleId}`,
          link: href,
        };
      } catch {
        return null;
      }
    };
    const getAdPost = (
      anchor: HTMLAnchorElement
    ): { canonical: string; link: string } | null => {
      try {
        const href = resolveSearchResultHref(anchor);
        const url = new URL(href);

        if (
          !url.hostname.includes('ader.naver.com') &&
          !url.hostname.includes('adcr.naver.com')
        ) {
          return null;
        }

        return {
          canonical: `ad:${url.toString()}`,
          link: url.toString(),
        };
      } catch {
        return null;
      }
    };
    const seenCanonicals = new Set<string>();
    const entries: Array<{ node: Element; item: VisibleContentItem }> = [];
    const root = getCollectionRoot();

    root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
      const resolvedHref = resolveSearchResultHref(anchor);
        const blogPost = getBlogPost(anchor) || getInfluencerPost(anchor);
      const cafePost = blogPost ? null : getCafePost(anchor);
      const adPost = blogPost || cafePost ? null : getAdPost(anchor);
      const canonical =
        blogPost?.canonical ?? cafePost?.canonical ?? adPost?.canonical ?? '';

      if (!canonical) {
        return;
      }

      entries.push({
        node: anchor,
        item: {
          type: blogPost ? 'blog' : cafePost ? 'cafe' : 'ad',
          canonical,
          title: getTitle(anchor),
          link: blogPost?.link ?? cafePost?.link ?? adPost?.link ?? resolvedHref,
          blogName: blogPost?.blogName ?? '',
          postPublishedAt: blogPost ? getPublishedAt(anchor) : '',
        },
      });
    });

    return entries
      .sort((left, right) =>
        left.node.compareDocumentPosition(right.node) &
        Node.DOCUMENT_POSITION_PRECEDING
          ? 1
          : -1
      )
      .map(({ item }) => item)
      .filter((item) => {
        if (seenCanonicals.has(item.canonical)) {
          return false;
        }

        seenCanonicals.add(item.canonical);
        return true;
      });
  }, rootSelector);

const parsePositiveNumber = (value: string): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`양수만 허용됨: ${value}`);
  }

  return Math.floor(parsed);
};

const parseSheetGid = (value: string): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`gid는 0 이상의 정수만 허용됨: ${value}`);
  }

  return parsed;
};

const normalizeSourceTab = (value: string): SourceTab | null => {
  const normalized = normalizeCell(value).toLowerCase();

  if (normalized === '패키지' || normalized === 'package') return '패키지';
  if (
    normalized === '일반건' ||
    normalized === 'dogmaru-exclude' ||
    normalized === 'general'
  ) {
    return '일반건';
  }
  if (normalized === '도그마루' || normalized === 'dogmaru') return '도그마루';
  if (normalized === '서리펫' || normalized === 'suripet' || normalized === 'suri-pet') {
    return '서리펫';
  }
  if (
    normalized === '애견' ||
    normalized === '애견(전체블로그)' ||
    normalized === 'pet'
  ) {
    return '애견';
  }
  if (normalized === '루트' || normalized === 'root') return '루트';
  if (
    normalized === '흑염소구' ||
    normalized === '흑염소 구' ||
    normalized === 'black-goat-old' ||
    normalized === 'blackgoatold'
  ) {
    return '흑염소 구';
  }
  if (normalized === '시트' || normalized === 'sheet') return '시트';

  return null;
};

const parseSourceTabs = (value: string): SourceTab[] => {
  const sourceTabs = value
    .split(',')
    .map(normalizeSourceTab)
    .filter((sourceTab): sourceTab is SourceTab => sourceTab !== null);

  if (sourceTabs.length === 0) {
    throw new Error(`유효한 sources가 없음: ${value}`);
  }

  return Array.from(new Set(sourceTabs));
};

const parseKeywordFilters = (value: string): string[] =>
  value
    .split(',')
    .map(normalizeCell)
    .filter(Boolean);

const parseTargetBlogIds = (value: string): string[] => {
  const blogIds = value
    .split(',')
    .map(extractBlogIdFromInput)
    .filter(Boolean);

  if (blogIds.length === 0) {
    throw new Error(`유효한 blog id가 없음: ${value}`);
  }

  return Array.from(new Set(blogIds));
};

const extractBlogIdFromPostLink = (link: string): string => {
  const normalized = normalizeCell(link);

  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    const directMatch = parsed.pathname.match(/^\/([^/]+)\/\d+/);

    return normalizeBlogId(
      parsed.searchParams.get('blogId') ?? directMatch?.[1] ?? ''
    );
  } catch {
    const match = normalized.match(/blog\.naver\.com\/([^/?&#]+)/);

    return normalizeBlogId(match?.[1] ?? '');
  }
};

const extractPostNoFromPostLink = (link: string): string => {
  const normalized = normalizeCell(link);

  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    const directMatch = parsed.pathname.match(/^\/([^/]+)\/(\d+)/);

    return normalizeCell(
      parsed.searchParams.get('logNo') ?? directMatch?.[2] ?? ''
    );
  } catch {
    const match = normalized.match(/blog\.naver\.com\/[^/?&#]+\/(\d+)/);

    return normalizeCell(match?.[1] ?? '');
  }
};

const buildWorkerSheetPostUrl = (link: string): string => {
  const blogId = extractBlogIdFromPostLink(link);
  const postNo = extractPostNoFromPostLink(link);

  return blogId && postNo
    ? `https://m.blog.naver.com/${blogId}/${postNo}`
    : normalizeCell(link);
};

const normalizeDateOnly = (value: unknown): string => {
  const normalized = normalizeCell(value);
  const match = normalized.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

  if (!match) {
    return normalized;
  }

  const [, year, month, day] = match;

  return `${year}.${String(Number(month)).padStart(2, '0')}.${String(
    Number(day)
  ).padStart(2, '0')}.`;
};

const isRemovedTargetPostLink = (link: string): boolean => {
  const blogId = extractBlogIdFromPostLink(link);

  return !!blogId && REMOVED_TARGET_BLOG_ID_SET.has(blogId);
};

const sanitizeCheckResult = (result: CheckResult): CheckResult => {
  const matches = getResultMatches(result).filter(
    (match) => !isRemovedTargetPostLink(match.link)
  );
  const externalMatches = getResultExternalMatches(result).filter(
    (match) =>
      !REMOVED_TARGET_BLOG_ID_SET.has(normalizeBlogId(match.blogId)) &&
      !isRemovedTargetPostLink(match.link)
  );
  const firstMatch = matches[0];

  return {
    ...result,
    exposed: !!firstMatch,
    position: firstMatch?.position ?? '',
    link: firstMatch?.link ?? '',
    postPublishedAt: firstMatch?.postPublishedAt ?? '',
    matches,
    externalMatches,
  };
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  let sheetId: string = TEST_CONFIG.SHEET_ID;
  let outputGid = DEFAULT_OUTPUT_GID;
  let outputTitle = DEFAULT_OUTPUT_TITLE;
  let inputGid: number | null = null;
  let inputTitle = '';
  let inputFromOutput = false;
  let limit = 0;
  let concurrency = DEFAULT_CONCURRENCY;
  let dryRun = false;
  let append = false;
  let partialUpdate = false;
  let rankOnly = false;
  let allMatches = false;
  let externalBlogLimit = DEFAULT_EXTERNAL_BLOG_LIMIT;
  let useCheckpoint = true;
  let inputExposedOnly = false;
  let maxMorePages = DEFAULT_MAX_MORE_PAGES;
  let maxScrolls = DEFAULT_MAX_SCROLLS;
  let maxResults = DEFAULT_MAX_RESULTS;
  let stableScrolls = DEFAULT_STABLE_SCROLLS;
  let mode: 'browser' | 'hybrid' | 'api' = 'browser';
  let sourceTabs = [...DEFAULT_SOURCE_TABS];
  let targetBlogIds: string[] = [...TARGET_BLOG_IDS];
  let targetBlogIdsOverridden = false;
  let keywordFilters: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextArg = args[index + 1];

    if (arg === '--') {
      continue;
    }

    if (arg === '--sheet-id' && nextArg) {
      sheetId = nextArg;
      index += 1;
      continue;
    }

    if (arg === '--output-gid' && nextArg) {
      outputGid = parseSheetGid(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--output-title' && nextArg) {
      outputTitle = nextArg;
      index += 1;
      continue;
    }

    if (arg === '--input-gid' && nextArg) {
      inputGid = parseSheetGid(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--input-title' && nextArg) {
      inputTitle = nextArg;
      index += 1;
      continue;
    }

    if (arg === '--from-output') {
      inputFromOutput = true;
      continue;
    }

    if (arg === '--limit' && nextArg) {
      limit = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--sources' && nextArg) {
      sourceTabs = parseSourceTabs(nextArg);
      index += 1;
      continue;
    }

    if ((arg === '--keyword' || arg === '--keywords') && nextArg) {
      keywordFilters = parseKeywordFilters(nextArg);
      index += 1;
      continue;
    }

    if (
      (arg === '--blog-id' || arg === '--blog-ids' || arg === '--blog-url') &&
      nextArg
    ) {
      targetBlogIds = parseTargetBlogIds(nextArg);
      targetBlogIdsOverridden = true;
      index += 1;
      continue;
    }

    if (arg === '--concurrency' && nextArg) {
      concurrency = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--max-more-pages' && nextArg) {
      maxMorePages = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--max-scrolls' && nextArg) {
      maxScrolls = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--max-results' && nextArg) {
      maxResults = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--stable-scrolls' && nextArg) {
      stableScrolls = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--mode' && nextArg) {
      if (!['browser', 'hybrid', 'api'].includes(nextArg)) {
        throw new Error(`mode는 browser/hybrid/api만 허용됨: ${nextArg}`);
      }
      mode = nextArg as 'browser' | 'hybrid' | 'api';
      index += 1;
      continue;
    }

    if (arg === '--external-blog-limit' && nextArg) {
      externalBlogLimit = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--append') {
      append = true;
      continue;
    }

    if (arg === '--partial-update') {
      partialUpdate = true;
      continue;
    }

    if (arg === '--rank-only') {
      rankOnly = true;
      continue;
    }

    if (arg === '--all-matches') {
      allMatches = true;
      continue;
    }

    if (arg === '--exposed-only') {
      inputExposedOnly = true;
      continue;
    }

    if (arg === '--no-checkpoint') {
      useCheckpoint = false;
      continue;
    }

    throw new Error(`알 수 없는 인자: ${arg}`);
  }

  return {
    sheetId,
    outputGid,
    outputTitle,
    inputGid,
    inputTitle,
    inputFromOutput,
    limit,
    concurrency,
    dryRun,
    append,
    partialUpdate,
    rankOnly,
    allMatches,
    externalBlogLimit,
    useCheckpoint,
    inputExposedOnly,
    maxMorePages,
    maxScrolls,
    maxResults,
    stableScrolls,
    mode,
    sourceTabs,
    targetBlogIds,
    targetBlogIdsOverridden,
    keywordFilters,
  };
};

const getHeaderColumnIndex = (
  headers: string[],
  aliases: string[]
): number | null => {
  const normalizedAliases = aliases.map(normalizeHeader);
  const columnIndex = headers.findIndex((header) =>
    normalizedAliases.includes(normalizeHeader(header))
  );

  return columnIndex >= 0 ? columnIndex : null;
};

const HEADER_ROW_SCAN_LIMIT = 10;

const loadHeaderValues = async (
  sheet: GoogleSpreadsheetWorksheet
): Promise<{ headers: string[]; headerRowIndex: number }> => {
  if (sheet.columnCount <= 0) {
    return { headers: [], headerRowIndex: 0 };
  }

  const scanRowCount = Math.min(HEADER_ROW_SCAN_LIMIT, sheet.rowCount);

  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: Math.max(scanRowCount, 1),
    startColumnIndex: 0,
    endColumnIndex: sheet.columnCount,
  });

  const readRow = (rowIndex: number): string[] => {
    const rowValues: string[] = [];
    for (let columnIndex = 0; columnIndex < sheet.columnCount; columnIndex += 1) {
      rowValues.push(getLoadedCellText(sheet, rowIndex, columnIndex));
    }
    return rowValues;
  };

  const scannedRows = Array.from({ length: scanRowCount }, (_, rowIndex) => readRow(rowIndex));
  const headerRowIndex = findHeaderRowIndex(scannedRows, '키워드');

  if (headerRowIndex !== null) {
    return { headers: scannedRows[headerRowIndex], headerRowIndex };
  }

  return { headers: scannedRows[0] ?? readRow(0), headerRowIndex: 0 };
};

const loadRequiredColumns = async (
  sheet: GoogleSpreadsheetWorksheet,
  columnIndexes: number[],
  startRowIndex = 1
): Promise<void> => {
  if (sheet.rowCount <= startRowIndex || columnIndexes.length === 0) {
    return;
  }

  const startColumnIndex = Math.min(...columnIndexes);
  const endColumnIndex = Math.max(...columnIndexes) + 1;

  await sheet.loadCells({
    startRowIndex,
    endRowIndex: sheet.rowCount,
    startColumnIndex,
    endColumnIndex,
  });
};

const getLoadedCellText = (
  sheet: GoogleSpreadsheetWorksheet,
  rowIndex: number,
  columnIndex: number | null
): string => {
  if (columnIndex === null) {
    return '';
  }

  const cell = sheet.getCell(rowIndex, columnIndex);

  return normalizeCell(cell.formattedValue ?? cell.value);
};

const getWorksheetByGidOrTitle = (
  doc: GoogleSpreadsheet,
  gid: number | null,
  title: string
): GoogleSpreadsheetWorksheet => {
  const sheet =
    (gid !== null ? doc.sheetsById[gid] : undefined) ??
    (title ? doc.sheetsByTitle[title] : undefined);

  if (!sheet) {
    throw new Error(`결과 탭을 찾을 수 없음: gid=${gid}, title=${title}`);
  }

  return sheet;
};

const getOrCreateOutputWorksheet = async (
  doc: GoogleSpreadsheet,
  gid: number | null,
  title: string
): Promise<GoogleSpreadsheetWorksheet> => {
  const sheetByTitle = title ? doc.sheetsByTitle[title] : undefined;

  if (sheetByTitle) {
    return sheetByTitle;
  }

  if (title) {
    return doc.addSheet({
      title,
      gridProperties: {
        rowCount: 1000,
        columnCount: OUTPUT_HEADERS.length,
      },
    });
  }

  const sheetByGid = gid !== null ? doc.sheetsById[gid] : undefined;

  if (sheetByGid) {
    return sheetByGid;
  }

  throw new Error(`결과 탭을 찾을 수 없음: gid=${gid}, title=${title}`);
};

const REAL_SOURCE_TAB_LOCATIONS: Partial<
  Record<SourceTab, { sheetId: string; tabTitle: string }>
> = EXPOSURE_SHEET_LOCATIONS;

const loadOldLogicKeywords = async (
  auth: JWT,
  doc: GoogleSpreadsheet,
  sourceTabs: SourceTab[]
): Promise<SourceKeywordRow[]> => {
  const rows: SourceKeywordRow[] = [];
  let pageCheckDoc: GoogleSpreadsheet | null = null;
  const realSourceDocCache = new Map<string, GoogleSpreadsheet>();

  for (const sourceTab of sourceTabs) {
    const realLocation = REAL_SOURCE_TAB_LOCATIONS[sourceTab];

    let resolvedSourceDoc: GoogleSpreadsheet;
    if (realLocation) {
      const cached = realSourceDocCache.get(realLocation.sheetId);
      if (cached) {
        resolvedSourceDoc = cached;
      } else {
        resolvedSourceDoc = await openSpreadsheet(realLocation.sheetId, auth);
        realSourceDocCache.set(realLocation.sheetId, resolvedSourceDoc);
      }
    } else if (sourceTab === '흑염소 구') {
      resolvedSourceDoc =
        pageCheckDoc ?? (pageCheckDoc = await openSpreadsheet(PAGE_CHECK_SHEET_ID, auth));
    } else {
      resolvedSourceDoc = doc;
    }

    const sheetTitle = realLocation
      ? realLocation.tabTitle
      : sourceTab === '애견'
        ? '애견(전체블로그)'
        : sourceTab;
    const sheet = resolvedSourceDoc.sheetsByTitle[sheetTitle];

    if (!sheet) {
      throw new Error(`"${sheetTitle}" 탭을 찾을 수 없음`);
    }

    const { headers: headerValues, headerRowIndex } = await loadHeaderValues(sheet);
    const keywordColumnIndex = getHeaderColumnIndex(headerValues, ['키워드']);
    const companyColumnIndex = getHeaderColumnIndex(headerValues, ['업체명']);
    const logicColumnIndex = getHeaderColumnIndex(headerValues, [
      '변경',
      '로직',
      '신규로직',
    ]);

    if (keywordColumnIndex === null) {
      throw new Error(`"${sourceTab}" 탭에 키워드 헤더 없음`);
    }

    const dataStartRowIndex = headerRowIndex + 1;

    await loadRequiredColumns(
      sheet,
      [keywordColumnIndex, companyColumnIndex, logicColumnIndex].filter(
        (columnIndex): columnIndex is number => columnIndex !== null
      ),
      dataStartRowIndex
    );

    for (let rowIndex = dataStartRowIndex; rowIndex < sheet.rowCount; rowIndex += 1) {
      const keyword = getLoadedCellText(sheet, rowIndex, keywordColumnIndex);
      if (!keyword) {
        continue;
      }

      const logicValue = getLoadedCellText(sheet, rowIndex, logicColumnIndex);

      if (sourceTab !== '애견' && isNewLogicValue(logicValue)) {
        continue;
      }

      rows.push({
        sourceTab,
        company: getLoadedCellText(sheet, rowIndex, companyColumnIndex),
        keyword,
        rowNumber: rowIndex + 1,
      });
    }
  }

  return rows;
};

const loadKeywordsFromWorksheet = async (
  sheet: GoogleSpreadsheetWorksheet,
  exposedOnly = false
): Promise<SourceKeywordRow[]> => {
  const { headers: headerValues, headerRowIndex } = await loadHeaderValues(sheet);
  const keywordColumnIndex = getHeaderColumnIndex(headerValues, ['키워드']);
  const exposureColumnIndex = getHeaderColumnIndex(headerValues, [
    '상태',
    '노출여부',
    '노출',
  ]);

  if (keywordColumnIndex === null) {
    throw new Error(`"${sheet.title}" 탭에 키워드 헤더 없음`);
  }

  if (exposedOnly && exposureColumnIndex === null) {
    throw new Error(`"${sheet.title}" 탭에 상태/노출여부 헤더 없음`);
  }

  const dataStartRowIndex = headerRowIndex + 1;

  await loadRequiredColumns(
    sheet,
    [keywordColumnIndex, exposureColumnIndex].filter(
      (columnIndex): columnIndex is number => columnIndex !== null
    ),
    dataStartRowIndex
  );

  const rows: SourceKeywordRow[] = [];

  for (let rowIndex = dataStartRowIndex; rowIndex < sheet.rowCount; rowIndex += 1) {
    const keyword = getLoadedCellText(sheet, rowIndex, keywordColumnIndex);

    if (!keyword) {
      continue;
    }

    if (exposedOnly && exposureColumnIndex !== null) {
      const exposureValue = getLoadedCellText(sheet, rowIndex, exposureColumnIndex)
        .toLowerCase();

      if (!['o', '노출'].includes(exposureValue)) {
        continue;
      }
    }

    rows.push({
      sourceTab: '시트',
      company: '',
      keyword,
      rowNumber: rowIndex + 1,
    });
  }

  return rows;
};

const extractLayerBridgeApiUrl = (
  href: string
): string => {
  const match = href.match(/lb_api=([^&]+)/);

  return match ? decodeURIComponent(match[1]) : '';
};

const findMoreApiUrl = (
  html: string
): { url: string; subject: string } | null => {
  const $ = cheerio.load(html);
  const candidates: Array<{ url: string; subject: string; score: number }> = [];

  $('a[href*="lb_api="]').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href') ?? '';
    const compactText = $link.text().replace(/\s+/g, '');
    const subject =
      normalizeCell($link.find('.fds-comps-footer-more-subject').first().text()) ||
      normalizeCell($link.text()).replace(/\s*더보기\s*$/, '');
    const url = extractLayerBridgeApiUrl(href);

    if (!url) {
      return;
    }

    let score = 0;
    if (compactText.includes('인기글더보기')) score += 10;
    if (subject.includes('인기글')) score += 5;
    if (url.includes('/review/')) score += 3;
    if (compactText.includes('더보기')) score += 1;

    if (score > 0) {
      candidates.push({
        url,
        subject: subject || '인기글',
        score,
      });
    }
  });

  candidates.sort((left, right) => right.score - left.score);

  return candidates[0] ?? null;
};

const parseLayerBridgeResponse = (body: string): LayerBridgeResponse => {
  const parsed: unknown = JSON.parse(body);

  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  return parsed as LayerBridgeResponse;
};

const loadMorePageItems = async (
  firstApiUrl: string,
  maxMorePages: number
): Promise<MorePageItem[]> => {
  const items: MorePageItem[] = [];
  const seenPostLinks = new Set<string>();
  const seenApiUrls = new Set<string>();
  let apiUrl = firstApiUrl;

  for (let page = 1; page <= maxMorePages && apiUrl; page += 1) {
    if (seenApiUrls.has(apiUrl)) {
      break;
    }
    seenApiUrls.add(apiUrl);

    const body = await fetchHtmlWithRetry(apiUrl, `더보기 API ${page}페이지`);
    const parsed = parseLayerBridgeResponse(body);
    const collection = Array.isArray(parsed.dom?.collection)
      ? parsed.dom.collection
      : [];
    const html = collection
      .map((entry) => (typeof entry.html === 'string' ? entry.html : ''))
      .filter(Boolean)
      .join('\n');

    if (html) {
      for (const blogItem of extractAllBlogLinks(html, page)) {
        const blogId = normalizeBlogId(blogItem.blogName);

        if (!blogItem.link || !blogId || seenPostLinks.has(blogItem.link)) {
          continue;
        }

        seenPostLinks.add(blogItem.link);
        items.push({
          title: blogItem.title,
          link: blogItem.link,
          blogId,
          position: items.length + 1,
        });
      }
    }

    apiUrl = typeof parsed.dom?.url === 'string' ? parsed.dom.url : '';

    if (apiUrl) {
      await randomDelay(700, 1400);
    }
  }

  return items;
};

const extractPublishedAtFromResultAnchor = (
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<any>
): string => {
  let $cursor = $el;
  const datePattern =
    /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?(?:\s*\d{1,2}:\d{2})?/;
  const relativePattern = /\d+\s*(?:분|시간|일|주|개월|년)\s*전/u;

  for (let depth = 0; depth < 8; depth += 1) {
    const subtext = normalizeCell(
      $cursor
        .find(
          '.sds-comps-profile-info-subtext, .sub_time, .date, [class*="date"], [class*="time"]'
        )
        .first()
        .text()
    );
    const subtextDate = subtext.match(datePattern)?.[0];
    if (subtextDate) return normalizeCell(subtextDate);
    const subtextRelative = subtext.match(relativePattern)?.[0];
    if (subtextRelative) return subtextRelative.replace(/\s+/g, '');

    const text = normalizeCell($cursor.text());
    const date = text.match(datePattern)?.[0];
    if (date) return normalizeCell(date);
    const relative = text.match(relativePattern)?.[0];
    if (relative) return relative.replace(/\s+/g, '');

    $cursor = $cursor.parent();
    if ($cursor.length === 0) break;
  }

  return '';
};

const extractContentItemsFromHtml = (html: string): VisibleContentItem[] => {
  const $ = cheerio.load(html);
  const seenCanonicals = new Set<string>();
  const items: VisibleContentItem[] = [];

  $('a[href]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href')?.trim() ?? '';
    const fallbackUrl =
      $el.attr('cru') ??
      $el.attr('data-url') ??
      $el.attr('data-cr-url') ??
      $el.attr('data-link-url') ??
      '';
    const blogPost =
      parseBlogPostFromHref(href, fallbackUrl) ||
      parseInfluencerPostFromHref(href, fallbackUrl);
    const cafePost = blogPost ? null : parseCafePostFromHref(href, fallbackUrl);
    const adPost = blogPost || cafePost ? null : parseAdPostFromHref(href, fallbackUrl);
    const canonical =
      blogPost?.canonical ?? cafePost?.canonical ?? adPost?.canonical ?? '';

    if (!canonical || seenCanonicals.has(canonical)) {
      return;
    }

    seenCanonicals.add(canonical);
    items.push({
      type: blogPost ? 'blog' : cafePost ? 'cafe' : 'ad',
      canonical,
      title: normalizeCell($el.text() || $el.attr('title') || ''),
      link: blogPost?.link ?? cafePost?.link ?? adPost?.link ?? href,
      blogName: blogPost?.blogName ?? '',
      postPublishedAt: blogPost
        ? extractPublishedAtFromResultAnchor($, $el)
        : '',
    });
  });

  return items;
};

const loadMorePageContentItems = async (
  firstApiUrl: string,
  maxMorePages: number,
  maxResults = DEFAULT_MAX_RESULTS
): Promise<{
  items: BlogItem[];
  checkedCount: number;
  scrollCount: number;
  scrollEndReason: string;
}> => {
  const seenContentPositions = new Map<string, number>();
  const seenBlogItems = new Map<string, BlogItem>();
  const seenApiUrls = new Set<string>();
  let apiUrl = firstApiUrl;
  let loadedPages = 0;

  for (let page = 1; page <= maxMorePages && apiUrl; page += 1) {
    if (seenApiUrls.has(apiUrl)) {
      break;
    }
    seenApiUrls.add(apiUrl);
    loadedPages = page;

    const body = await fetchHtmlWithRetry(apiUrl, `더보기 API ${page}페이지`);
    const parsed = parseLayerBridgeResponse(body);
    const topLevelCollection = (parsed as {
      collection?: LayerBridgeCollection[];
    }).collection;
    const collection = [
      ...(Array.isArray(parsed.dom?.collection) ? parsed.dom.collection : []),
      ...(Array.isArray(topLevelCollection) ? topLevelCollection : []),
    ];
    const html = collection
      .map((entry) => (typeof entry.html === 'string' ? entry.html : ''))
      .filter(Boolean)
      .join('\n');

    for (const item of extractContentItemsFromHtml(html)) {
      if (!seenContentPositions.has(item.canonical)) {
        if (seenContentPositions.size >= maxResults) {
          break;
        }
        seenContentPositions.set(item.canonical, seenContentPositions.size + 1);
      }

      if (item.type === 'blog' && !seenBlogItems.has(item.link)) {
        seenBlogItems.set(item.link, {
          title: item.title,
          link: item.link,
          blogName: item.blogName,
          page,
          position: seenContentPositions.get(item.canonical),
          postPublishedAt: item.postPublishedAt,
        });
      }
    }

    if (seenContentPositions.size >= maxResults) {
      break;
    }

    apiUrl =
      typeof parsed.dom?.url === 'string'
        ? parsed.dom.url
        : typeof (parsed as { url?: unknown }).url === 'string'
          ? ((parsed as { url?: string }).url ?? '')
          : '';

    if (apiUrl) {
      await randomDelay(250, 500);
    }
  }

  return {
    items: Array.from(seenBlogItems.values()),
    checkedCount: seenContentPositions.size,
    scrollCount: loadedPages,
    scrollEndReason:
      seenContentPositions.size >= maxResults ? 'result-limit' : 'stable',
  };
};

const getMoreLinkCandidates = async (page: Page): Promise<MoreLinkCandidate[]> => {
  const moreLinks = page.locator('a[href*="lb_api="]');
  const candidates = await moreLinks.evaluateAll((elements) =>
    elements.map((element, index) => {
      const text = String(element.textContent ?? '').replace(/\s+/g, '');
      const href = String((element as HTMLAnchorElement).href ?? '');
      const trigger = String(element.getAttribute('data-lb-trigger') ?? '');
      let score = 0;
      if (text.includes('인기글더보기')) score += 10;
      if (text.includes('인기글')) score += 5;
      if (text.includes('더보기')) score += 2;
      if (href.includes('/review/')) score += 3;

      return {
        index,
        text,
        href,
        trigger,
        score,
      };
    })
  );

  return candidates
    .map(({ href, trigger, ...candidate }) => ({
      ...candidate,
      url: extractLayerBridgeApiUrl(href) || trigger,
    }))
    .filter(({ score, url }) => score > 0 && !!url)
    .sort((left, right) => right.score - left.score);
};

const findBestMoreLinkCandidate = async (
  page: Page
): Promise<MoreLinkCandidate | null> => {
  for (let attempt = 1; attempt <= MORE_LINK_DISCOVERY_ATTEMPTS; attempt += 1) {
    const bestCandidate = (await getMoreLinkCandidates(page))[0];

    if (bestCandidate) {
      return bestCandidate;
    }

    await page.mouse.wheel(0, MORE_LINK_DISCOVERY_SCROLL_Y);
    await page.waitForTimeout(MORE_LINK_DISCOVERY_WAIT_MS);
  }

  return (await getMoreLinkCandidates(page))[0] ?? null;
};

const collectPageContentItems = async (
  page: Page,
  maxScrolls: number,
  maxResults: number,
  stableScrolls: number,
  rootSelector = ''
): Promise<{
  items: BlogItem[];
  checkedCount: number;
  scrollCount: number;
  scrollEndReason: string;
}> => {
  const seenContentPositions = new Map<string, number>();
  const seenBlogItems = new Map<string, BlogItem>();
  let loadedContentCount = 0;
  let previousCount = -1;
  let stableCount = 0;
  let scrollCount = 0;
  let scrollEndReason = 'max-scrolls';
  const collectVisibleItems = async (): Promise<number> => {
    const visibleItems = await extractVisibleContentItems(page, rootSelector);

    visibleItems.forEach((item) => {
      if (!seenContentPositions.has(item.canonical)) {
        if (seenContentPositions.size >= maxResults) {
          return;
        }

        seenContentPositions.set(item.canonical, seenContentPositions.size + 1);
      }

      if (item.type === 'blog' && !seenBlogItems.has(item.link)) {
        seenBlogItems.set(item.link, {
          title: item.title,
          link: item.link,
          blogName: item.blogName,
          page: 1,
          position: seenContentPositions.get(item.canonical),
          postPublishedAt: item.postPublishedAt,
        });
      }
    });

    return seenContentPositions.size;
  };

  for (let scroll = 0; scroll < maxScrolls; scroll += 1) {
    loadedContentCount = await collectVisibleItems();

    if (loadedContentCount >= maxResults) {
      scrollEndReason = 'result-limit';
      break;
    }

    if (loadedContentCount > previousCount) {
      previousCount = loadedContentCount;
      stableCount = 0;
    } else {
      stableCount += 1;
    }

    if (stableCount >= stableScrolls) {
      const minimumScrollsBeforeStable =
        getMinimumScrollsBeforeStable(loadedContentCount);

      if (scrollCount < minimumScrollsBeforeStable) {
        await page.mouse.wheel(0, 6000);
        scrollCount += 1;
        await page.waitForTimeout(SCROLL_WAIT_MS);
        continue;
      }

      scrollEndReason = 'stable';
      break;
    }

    await page.mouse.wheel(0, 6000);
    scrollCount += 1;
    await page.waitForTimeout(SCROLL_WAIT_MS);
  }

  await collectVisibleItems();

  return {
    items: Array.from(seenBlogItems.values()),
    checkedCount: seenContentPositions.size,
    scrollCount,
    scrollEndReason,
  };
};

const selectBestMoreLink = async (
  context: BrowserContext,
  keyword: string,
  maxScrolls: number,
  maxResults: number,
  stableScrolls: number
): Promise<{
  items: BlogItem[];
  checkedCount: number;
  subject: string;
  scrollCount: number;
  scrollEndReason: string;
}> => {
  const page = await context.newPage();

  try {
    await page.goto(buildNaverSearchUrl(keyword), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(SEARCH_SETTLE_WAIT_MS);

    const moreLinks = page.locator('a[href*="lb_api="]');
    const bestCandidate = await findBestMoreLinkCandidate(page);

    if (!bestCandidate) {
      const fallbackResult = await collectPageContentItems(
        page,
        maxScrolls,
        maxResults,
        stableScrolls
      );

      return {
        ...fallbackResult,
        subject: '통합검색 글',
      };
    }

    const responsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/p/review/') &&
          response.url().includes('search.naver'),
        { timeout: 10000 }
      )
      .catch(() => null);

    await moreLinks.nth(bestCandidate.index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(BEFORE_MORE_CLICK_WAIT_MS);
    await moreLinks.nth(bestCandidate.index).click({
      force: true,
      timeout: 10000,
    });
    await responsePromise;
    await page.waitForTimeout(MORE_LAYER_SETTLE_WAIT_MS);
    const collectedResult = await collectPageContentItems(
      page,
      maxScrolls,
      maxResults,
      stableScrolls,
      MORE_RESULT_ROOT_SELECTOR
    );

    return {
      ...collectedResult,
      subject: bestCandidate.text || '인기글',
    };
  } finally {
    await page.close().catch(() => {});
  }
};

const loadMoreItemsWithRetry = async (
  context: BrowserContext,
  keyword: string,
  maxScrolls: number,
  maxResults: number,
  stableScrolls: number,
  mode: 'browser' | 'hybrid' | 'api'
): Promise<{
  items: BlogItem[];
  checkedCount: number;
  subject: string;
  scrollCount: number;
  scrollEndReason: string;
}> => {
  if (mode === 'hybrid' || mode === 'api') {
    try {
      const searchHtml = await fetchHtmlWithRetry(
        buildNaverSearchUrl(keyword),
        '검색 HTML'
      );
      const moreApi = findMoreApiUrl(searchHtml);

      if (!moreApi) {
        throw new Error('더보기 API URL 없음');
      }

      const apiResult = await loadMorePageContentItems(
        moreApi.url,
        DEFAULT_MAX_MORE_PAGES,
        maxResults
      );

      if (apiResult.checkedCount >= API_MIN_CHECKED_COUNT || mode === 'api') {
        return {
          ...apiResult,
          subject: moreApi.subject,
        };
      }

      throw new Error(`API 결과 저개수(${apiResult.checkedCount}개)`);
    } catch (error) {
      if (mode === 'api') {
        throw error;
      }
      logger.warn(
        `API 경로 실패, 브라우저 fallback: ${keyword} (${getErrorMessage(error)})`
      );
    }
  }

  let bestResult: {
    items: BlogItem[];
    checkedCount: number;
    subject: string;
    scrollCount: number;
    scrollEndReason: string;
  } | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_SCROLL_ATTEMPTS; attempt += 1) {
    let result: {
      items: BlogItem[];
      checkedCount: number;
      subject: string;
      scrollCount: number;
      scrollEndReason: string;
    };

    try {
      result = await selectBestMoreLink(
        context,
        keyword,
        maxScrolls,
        maxResults,
        stableScrolls
      );
    } catch (error) {
      lastError = error;
      await randomDelay(1200, 2200);
      continue;
    }

    if (!bestResult || result.checkedCount > bestResult.checkedCount) {
      bestResult = result;
    }

    if (result.checkedCount === 0) {
      lastError = new Error('더보기 결과 0개');
      await randomDelay(1200, 2200);
      continue;
    }

    if (result.scrollEndReason === 'stable' || result.scrollEndReason === 'result-limit') {
      return result;
    }

    await randomDelay(1200, 2200);
  }

  if (
    !bestResult ||
    bestResult.checkedCount === 0
  ) {
    throw lastError instanceof Error
      ? lastError
      : new Error('더보기 스크롤 결과 없음');
  }

  return bestResult;
};

const toExposureResult = (
  query: string,
  item: BlogItem
): ExposureResult => ({
  query,
  blogId: normalizeBlogId(item.blogName),
  blogName: item.blogName,
  postTitle: item.title,
  postLink: item.link,
  postPublishedAt: item.postPublishedAt,
  exposureType: '더보기',
  topicName: '인기글 더보기',
  position: item.position ?? 0,
  page: item.page,
});

const filterItemsByVendorTarget = async (
  query: string,
  items: BlogItem[],
  vendorTarget: string
): Promise<BlogItem[]> => {
  if (!vendorTarget) {
    return items;
  }

  const passedItems: BlogItem[] = [];

  for (const item of items) {
    const match = await findMatchingPost(
      [toExposureResult(query, item)],
      vendorTarget,
      vendorTarget
    );

    if (match.passed) {
      passedItems.push(item);
    }
  }

  return passedItems;
};

const checkKeyword = async (
  targetKey: string,
  keyword: string,
  searchKeyword: string,
  vendorTarget: string,
  targetBlogIdSet: Set<string>,
  externalExcludedBlogIdSet: Set<string>,
  context: BrowserContext,
  matchLimit: number,
  externalBlogLimit: number,
  maxScrolls: number,
  maxResults: number,
  stableScrolls: number,
  mode: 'browser' | 'hybrid' | 'api'
): Promise<CheckResult> => {
  try {
    const effectiveMode = mode === 'hybrid' ? 'browser' : mode;
    const { items, checkedCount, subject, scrollCount, scrollEndReason } =
      await loadMoreItemsWithRetry(
      context,
      searchKeyword,
      maxScrolls,
      maxResults,
      stableScrolls,
      effectiveMode
    );
    const targetMatchedItems = items
      .filter((item) => targetBlogIdSet.has(normalizeBlogId(item.blogName)))
      .sort(
        (left, right) =>
          (left.position ?? Number.MAX_SAFE_INTEGER) -
          (right.position ?? Number.MAX_SAFE_INTEGER)
      );
    const matchedItems = (await filterItemsByVendorTarget(
      searchKeyword,
      targetMatchedItems,
      vendorTarget
    ))
      .slice(0, Math.max(1, matchLimit));
    const matches: CheckMatch[] = [];

    for (const matchedItem of matchedItems) {
      matches.push({
        position: matchedItem.position ?? items.indexOf(matchedItem) + 1,
        link: matchedItem.link,
        postPublishedAt: await resolvePostPublishedAt(
          matchedItem.link,
          matchedItem.postPublishedAt ?? ''
        ),
      });
    }

    const externalItems = externalBlogLimit > 0
      ? items
          .filter(
            (item) =>
              !externalExcludedBlogIdSet.has(normalizeBlogId(item.blogName))
          )
          .sort(
            (left, right) =>
              (left.position ?? Number.MAX_SAFE_INTEGER) -
              (right.position ?? Number.MAX_SAFE_INTEGER)
          )
          .slice(0, externalBlogLimit)
      : [];
    const externalMatches: ExternalBlogMatch[] = [];

    for (const externalItem of externalItems) {
      externalMatches.push({
        position: externalItem.position ?? items.indexOf(externalItem) + 1,
        blogId: normalizeBlogId(externalItem.blogName),
        link: externalItem.link,
        postPublishedAt: await resolvePostPublishedAt(
          externalItem.link,
          externalItem.postPublishedAt ?? ''
        ),
      });
    }

    const matched = matches[0];

    return {
      targetKey,
      keyword,
      searchKeyword,
      vendorTarget,
      exposed: !!matched,
      position: matched?.position ?? '',
      link: matched?.link ?? '',
      postPublishedAt: matched?.postPublishedAt ?? '',
      matches,
      externalMatches,
      subject,
      checkedCount,
      scrollCount,
      scrollEndReason,
      error:
        scrollEndReason === 'max-scrolls'
          ? `스크롤 상한 도달(${checkedCount}개)`
          : '',
    };
  } catch (error) {
    return {
      targetKey,
      keyword,
      searchKeyword,
      vendorTarget,
      exposed: false,
      position: '',
      link: '',
      postPublishedAt: '',
      matches: [],
      externalMatches: [],
      subject: '',
      checkedCount: 0,
      scrollCount: 0,
      scrollEndReason: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

interface CheckpointPayload {
  version: number;
  updatedAt: string;
  results: CheckResult[];
}

const loadCheckpoint = (): Map<string, CheckResult> => {
  if (!fs.existsSync(DEFAULT_CHECKPOINT_PATH)) {
    return new Map();
  }

  try {
    const raw = fs.readFileSync(DEFAULT_CHECKPOINT_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CheckpointPayload>;
    if (parsed.version !== CHECKPOINT_VERSION) {
      logger.warn('체크포인트 버전 변경 감지, 새로 시작');
      return new Map();
    }
    const results = Array.isArray(parsed.results) ? parsed.results : [];

    return new Map(
      results
        .filter((result): result is CheckResult => !!result?.keyword)
        .map((result) => sanitizeCheckResult(result))
        .map((result) => [result.targetKey || result.keyword, result])
    );
  } catch (error) {
    logger.warn(
      `체크포인트 로드 실패, 새로 시작: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return new Map();
  }
};

const saveCheckpoint = (resultMap: Map<string, CheckResult>): void => {
  fs.mkdirSync(path.dirname(DEFAULT_CHECKPOINT_PATH), { recursive: true });
  fs.writeFileSync(
    DEFAULT_CHECKPOINT_PATH,
    JSON.stringify(
      {
        version: CHECKPOINT_VERSION,
        updatedAt: new Date().toISOString(),
        results: Array.from(resultMap.values()),
      },
      null,
      2
    )
  );
};

const runWithConcurrency = async <T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(values.length);
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      runWorker()
    )
  );

  return results;
};

const getResultMatches = (result?: CheckResult): CheckMatch[] => {
  if (!result) {
    return [];
  }

  if (Array.isArray(result.matches) && result.matches.length > 0) {
    return result.matches;
  }

  if (result.link && result.position) {
    return [
      {
        position: Number(result.position),
        link: result.link,
        postPublishedAt: result.postPublishedAt,
      },
    ];
  }

  return [];
};

const getResultExternalMatches = (result?: CheckResult): ExternalBlogMatch[] => {
  if (!result || !Array.isArray(result.externalMatches)) {
    return [];
  }

  return result.externalMatches;
};

const getTopExternalPublishedDates = (
  result?: CheckResult
): [string, string, string] => {
  const dates: string[] = [];
  const seenDates = new Set<string>();

  getResultExternalMatches(result)
    .slice()
    .sort((left, right) => left.position - right.position)
    .forEach((match) => {
      const date = normalizeDateOnly(match.postPublishedAt);

      if (!date || seenDates.has(date)) {
        return;
      }

      seenDates.add(date);
      dates.push(date);
    });

  return [dates[0] ?? '', dates[1] ?? '', dates[2] ?? ''];
};

const buildWorkerOutputRows = (
  rows: SourceKeywordRow[],
  resultMap: Map<string, CheckResult>
): OutputRow[] => {
  const outputRows: OutputRow[] = [];
  const seenTargets = new Set<string>();

  rows.forEach((row) => {
    const target = resolveKeywordTarget(row);

    if (seenTargets.has(target.targetKey)) {
      return;
    }

    seenTargets.add(target.targetKey);
    const result = resultMap.get(target.targetKey);
    const matches = getResultMatches(result);
    const topDates = getTopExternalPublishedDates(result);

    if (matches.length === 0) {
      outputRows.push([
        target.outputKeyword,
        '',
        '',
        '',
        '',
        topDates[0],
        topDates[1],
        topDates[2],
        result?.error ? `오류: ${result.error}` : '미노출',
      ]);

      return;
    }

    matches.forEach((match, index) => {
      const showKeywordMeta = index === 0;

      outputRows.push([
        target.outputKeyword,
        extractBlogIdFromPostLink(match.link),
        match.position,
        buildWorkerSheetPostUrl(match.link),
        normalizeDateOnly(match.postPublishedAt),
        showKeywordMeta ? topDates[0] : '',
        showKeywordMeta ? topDates[1] : '',
        showKeywordMeta ? topDates[2] : '',
        '노출',
      ]);
    });
  });

  return outputRows;
};

const isBlankOutputRow = (row: OutputRow): boolean =>
  row.every((value) => normalizeCell(value) === '');

const groupOutputRows = (rows: OutputRow[]): OutputRowGroup[] => {
  const groups: OutputRowGroup[] = [];
  let currentGroup: OutputRowGroup | null = null;

  rows.forEach((row) => {
    if (isBlankOutputRow(row)) {
      return;
    }

    const keyword = normalizeCell(row[0]);

    if (keyword) {
      if (currentGroup?.keyword === keyword) {
        currentGroup.rows.push(row);
      } else {
        currentGroup = { keyword, rows: [row] };
        groups.push(currentGroup);
      }
      return;
    }

    if (currentGroup) {
      currentGroup.rows.push(row);
    }
  });

  return groups;
};

const readExistingOutputRowGroups = async (
  sheet: GoogleSpreadsheetWorksheet
): Promise<OutputRowGroup[]> => {
  if (sheet.rowCount <= 1) {
    return [];
  }

  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: OUTPUT_HEADERS.length,
  });

  const rows: OutputRow[] = [];

  for (let rowIndex = 1; rowIndex < sheet.rowCount; rowIndex += 1) {
    const row: OutputRow = [];

    for (
      let columnIndex = 0;
      columnIndex < OUTPUT_HEADERS.length;
      columnIndex += 1
    ) {
      const cell = sheet.getCell(rowIndex, columnIndex);
      const value = cell.value;
      row.push(
        typeof value === 'number'
          ? value
          : normalizeCell(cell.formattedValue ?? value)
      );
    }

    rows.push(row);
  }

  return groupOutputRows(rows);
};

const mergePartialOutputRows = async (
  sheet: GoogleSpreadsheetWorksheet,
  replacementRows: OutputRow[],
  replaceKeywords: Set<string>
): Promise<OutputRow[]> => {
  const normalizedReplaceKeywords = new Set(
    Array.from(replaceKeywords).map(normalizeCell)
  );
  const existingGroups = await readExistingOutputRowGroups(sheet);
  const replacementGroups = groupOutputRows(replacementRows);
  const mergedGroups: OutputRowGroup[] = [];
  let insertedReplacementGroups = false;

  existingGroups.forEach((group) => {
    if (normalizedReplaceKeywords.has(group.keyword)) {
      if (!insertedReplacementGroups) {
        mergedGroups.push(...replacementGroups);
        insertedReplacementGroups = true;
      }
      return;
    }

    mergedGroups.push(group);
  });

  if (!insertedReplacementGroups) {
    mergedGroups.push(...replacementGroups);
  }

  return mergedGroups.flatMap((group) => group.rows);
};

const rgb = (
  hex: string
): { red: number; green: number; blue: number } => {
  const normalized = hex.replace('#', '');

  return {
    red: parseInt(normalized.slice(0, 2), 16) / 255,
    green: parseInt(normalized.slice(2, 4), 16) / 255,
    blue: parseInt(normalized.slice(4, 6), 16) / 255,
  };
};

const colorStyle = (
  hex: string
): { rgbColor: { red: number; green: number; blue: number } } => ({
  rgbColor: rgb(hex),
});

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getGoogleApiStatus = (error: unknown): number => {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: { error?: { code?: number } };
      };
    }
  ).response;

  return Number(response?.status ?? response?.data?.error?.code ?? 0);
};

const isRetryableGoogleApiStatus = (status: number): boolean =>
  [0, 429, 500, 502, 503, 504].includes(status);

const requestGoogleSheetsWithRetry = async <T>(
  auth: JWT,
  config: Parameters<JWT['request']>[0],
  label: string,
  maxAttempts = 5
): Promise<{ data: T }> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await auth.request<T>(config);
    } catch (error) {
      lastError = error;
      const status = getGoogleApiStatus(error);

      if (!isRetryableGoogleApiStatus(status) || attempt === maxAttempts) {
        break;
      }

      logger.warn(
        `${label} 재시도 ${attempt}/${maxAttempts}: Google API ${status}`
      );
      await wait(1000 * attempt * attempt);
    }
  }

  throw lastError;
};

const saveUpdatedCellsWithRetry = async (
  sheet: GoogleSpreadsheetWorksheet,
  maxAttempts = 5
): Promise<void> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await sheet.saveUpdatedCells();
      return;
    } catch (error) {
      lastError = error;
      const status = getGoogleApiStatus(error);

      if (!isRetryableGoogleApiStatus(status) || attempt === maxAttempts) {
        break;
      }

      logger.warn(
        `시트 값 저장 재시도 ${attempt}/${maxAttempts}: Google API ${status}`
      );
      await wait(1000 * attempt * attempt);
    }
  }

  throw lastError;
};

const formatWorkerOutputSheet = async (
  auth: JWT,
  spreadsheetId: string,
  sheet: GoogleSpreadsheetWorksheet,
  rowCount: number
): Promise<void> => {
  const metadataResponse = await requestGoogleSheetsWithRetry<{
    sheets?: Array<{
      properties?: { sheetId?: number };
      conditionalFormats?: unknown[];
    }>;
  }>(
    auth,
    {
      url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId),conditionalFormats)`,
    },
    '시트 서식 메타데이터 조회'
  );
  const targetSheet = metadataResponse.data.sheets?.find(
    (entry) => entry.properties?.sheetId === sheet.sheetId
  );
  const existingRuleCount = targetSheet?.conditionalFormats?.length ?? 0;
  const requests: Array<Record<string, unknown>> = [];

  for (let index = existingRuleCount - 1; index >= 0; index -= 1) {
    requests.push({
      deleteConditionalFormatRule: {
        sheetId: sheet.sheetId,
        index,
      },
    });
  }

  const fullRange = {
    sheetId: sheet.sheetId,
    startRowIndex: 0,
    endRowIndex: rowCount,
    startColumnIndex: 0,
    endColumnIndex: OUTPUT_HEADERS.length,
  };

  requests.push(
    { clearBasicFilter: { sheetId: sheet.sheetId } },
    {
      repeatCell: {
        range: fullRange,
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: colorStyle('#FFFFFF'),
            textFormat: {
              fontSize: 10,
              foregroundColorStyle: colorStyle('#202124'),
            },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'CLIP',
          },
        },
        fields:
          'userEnteredFormat(backgroundColorStyle,textFormat,verticalAlignment,wrapStrategy)',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: OUTPUT_HEADERS.length,
        },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: colorStyle('#2F5597'),
            textFormat: {
              bold: true,
              foregroundColorStyle: colorStyle('#FFFFFF'),
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
          },
        },
        fields:
          'userEnteredFormat(backgroundColorStyle,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: colorStyle('#EAF2FF'),
            textFormat: { bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColorStyle,textFormat.bold)',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 1,
          endColumnIndex: 5,
        },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: colorStyle('#EAF7EA'),
          },
        },
        fields: 'userEnteredFormat.backgroundColorStyle',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 5,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: colorStyle('#FFF3CD'),
          },
        },
        fields: 'userEnteredFormat.backgroundColorStyle',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 8,
          endColumnIndex: 9,
        },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: colorStyle('#F1F3F4'),
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
          },
        },
        fields:
          'userEnteredFormat(backgroundColorStyle,textFormat.bold,horizontalAlignment)',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 2,
          endColumnIndex: 3,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 4,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    {
      updateBorders: {
        range: fullRange,
        top: { style: 'SOLID', width: 1, colorStyle: colorStyle('#DADCE0') },
        bottom: { style: 'SOLID', width: 1, colorStyle: colorStyle('#DADCE0') },
        left: { style: 'SOLID', width: 1, colorStyle: colorStyle('#DADCE0') },
        right: { style: 'SOLID', width: 1, colorStyle: colorStyle('#DADCE0') },
        innerHorizontal: {
          style: 'SOLID',
          width: 1,
          colorStyle: colorStyle('#E8EAED'),
        },
        innerVertical: {
          style: 'SOLID',
          width: 1,
          colorStyle: colorStyle('#E8EAED'),
        },
      },
    },
    {
      setBasicFilter: {
        filter: {
          range: fullRange,
        },
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheet.sheetId,
          gridProperties: {
            frozenRowCount: 1,
            frozenColumnCount: 1,
            rowCount,
            columnCount: OUTPUT_HEADERS.length,
          },
        },
        fields:
          'gridProperties(frozenRowCount,frozenColumnCount,rowCount,columnCount)',
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: sheet.sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 34 },
        fields: 'pixelSize',
      },
    }
  );

  [
    [0, 1, 190],
    [1, 2, 125],
    [2, 3, 70],
    [3, 4, 360],
    [4, 8, 122],
    [8, 9, 95],
  ].forEach(([startIndex, endIndex, pixelSize]) => {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: sheet.sheetId,
          dimension: 'COLUMNS',
          startIndex,
          endIndex,
        },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    });
  });

  [
    {
      range: {
        sheetId: sheet.sheetId,
        startRowIndex: 1,
        endRowIndex: rowCount,
        startColumnIndex: 8,
        endColumnIndex: 9,
      },
      condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: '노출' }] },
      format: {
        backgroundColorStyle: colorStyle('#C6EFCE'),
        textFormat: {
          foregroundColorStyle: colorStyle('#006100'),
          bold: true,
        },
      },
    },
    {
      range: {
        sheetId: sheet.sheetId,
        startRowIndex: 1,
        endRowIndex: rowCount,
        startColumnIndex: 8,
        endColumnIndex: 9,
      },
      condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: '미노출' }] },
      format: {
        backgroundColorStyle: colorStyle('#FCE4D6'),
        textFormat: {
          foregroundColorStyle: colorStyle('#9C0006'),
          bold: true,
        },
      },
    },
    {
      range: {
        sheetId: sheet.sheetId,
        startRowIndex: 1,
        endRowIndex: rowCount,
        startColumnIndex: 8,
        endColumnIndex: 9,
      },
      condition: {
        type: 'TEXT_STARTS_WITH',
        values: [{ userEnteredValue: '오류:' }],
      },
      format: {
        backgroundColorStyle: colorStyle('#F4CCCC'),
        textFormat: {
          foregroundColorStyle: colorStyle('#990000'),
          bold: true,
        },
      },
    },
    {
      range: {
        sheetId: sheet.sheetId,
        startRowIndex: 1,
        endRowIndex: rowCount,
        startColumnIndex: 2,
        endColumnIndex: 3,
      },
      condition: {
        type: 'CUSTOM_FORMULA',
        values: [{ userEnteredValue: '=AND($C2<>"",VALUE($C2)<=50)' }],
      },
      format: {
        backgroundColorStyle: colorStyle('#C6EFCE'),
        textFormat: {
          foregroundColorStyle: colorStyle('#006100'),
          bold: true,
        },
      },
    },
    {
      range: {
        sheetId: sheet.sheetId,
        startRowIndex: 1,
        endRowIndex: rowCount,
        startColumnIndex: 2,
        endColumnIndex: 3,
      },
      condition: {
        type: 'CUSTOM_FORMULA',
        values: [
          { userEnteredValue: '=AND($C2<>"",VALUE($C2)>50,VALUE($C2)<=150)' },
        ],
      },
      format: {
        backgroundColorStyle: colorStyle('#FFEB9C'),
        textFormat: {
          foregroundColorStyle: colorStyle('#9C6500'),
          bold: true,
        },
      },
    },
    {
      range: {
        sheetId: sheet.sheetId,
        startRowIndex: 1,
        endRowIndex: rowCount,
        startColumnIndex: 2,
        endColumnIndex: 3,
      },
      condition: {
        type: 'CUSTOM_FORMULA',
        values: [{ userEnteredValue: '=AND($C2<>"",VALUE($C2)>150)' }],
      },
      format: {
        backgroundColorStyle: colorStyle('#F4CCCC'),
        textFormat: {
          foregroundColorStyle: colorStyle('#990000'),
          bold: true,
        },
      },
    },
  ].forEach(({ range, condition, format }, index) => {
    requests.push({
      addConditionalFormatRule: {
        index,
        rule: {
          ranges: [range],
          booleanRule: {
            condition,
            format,
          },
        },
      },
    });
  });

  await requestGoogleSheetsWithRetry(
    auth,
    {
      url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      method: 'POST',
      data: { requests },
    },
    '시트 서식 적용'
  );
};

const writeResults = async (
  auth: JWT,
  spreadsheetId: string,
  sheet: GoogleSpreadsheetWorksheet,
  rows: SourceKeywordRow[],
  resultMap: Map<string, CheckResult>,
  append: boolean,
  partialUpdateKeywords: Set<string> | null = null
): Promise<void> => {
  let outputRows = buildWorkerOutputRows(rows, resultMap);
  let appendStartRowIndex = 0;

  if (partialUpdateKeywords && partialUpdateKeywords.size > 0) {
    if (append) {
      throw new Error('partial-update와 append는 같이 사용할 수 없음');
    }

    outputRows = await mergePartialOutputRows(
      sheet,
      outputRows,
      partialUpdateKeywords
    );
  }

  if (append) {
    await sheet.loadCells({
      startRowIndex: 0,
      endRowIndex: sheet.rowCount,
      startColumnIndex: 0,
      endColumnIndex: 1,
    });

    let lastNonEmptyRowIndex = -1;
    for (let rowIndex = 0; rowIndex < sheet.rowCount; rowIndex += 1) {
      const value = normalizeCell(
        sheet.getCell(rowIndex, 0).formattedValue ??
          sheet.getCell(rowIndex, 0).value
      );
      if (value) {
        lastNonEmptyRowIndex = rowIndex;
      }
    }

    appendStartRowIndex = lastNonEmptyRowIndex < 0 ? 0 : lastNonEmptyRowIndex + 1;
  }

  const shouldWriteHeader = !append || appendStartRowIndex === 0;
  const dataStartRowIndex = shouldWriteHeader ? 1 : appendStartRowIndex;
  const totalRows = dataStartRowIndex + outputRows.length;

  if (sheet.rowCount < totalRows || sheet.columnCount < OUTPUT_HEADERS.length) {
    await sheet.resize({
      rowCount: Math.max(sheet.rowCount, totalRows),
      columnCount: Math.max(sheet.columnCount, OUTPUT_HEADERS.length),
    });
  }

  await sheet.loadCells({
    startRowIndex: shouldWriteHeader ? 0 : dataStartRowIndex,
    endRowIndex: Math.max(sheet.rowCount, totalRows),
    startColumnIndex: 0,
    endColumnIndex: OUTPUT_HEADERS.length,
  });

  if (!append) {
    for (let rowIndex = 0; rowIndex < sheet.rowCount; rowIndex += 1) {
      for (
        let columnIndex = 0;
        columnIndex < OUTPUT_HEADERS.length;
        columnIndex += 1
      ) {
        sheet.getCell(rowIndex, columnIndex).value = '';
      }
    }
  }

  if (shouldWriteHeader) {
    OUTPUT_HEADERS.forEach((header, columnIndex) => {
      sheet.getCell(0, columnIndex).value = header;
    });
  }

  outputRows.forEach((row, rowOffset) => {
    row.forEach((value, columnIndex) => {
      sheet.getCell(dataStartRowIndex + rowOffset, columnIndex).value = value;
    });
  });

  await saveUpdatedCellsWithRetry(sheet);

  await formatWorkerOutputSheet(auth, spreadsheetId, sheet, totalRows);
};

const writeRankOnlyResults = async (
  sheet: GoogleSpreadsheetWorksheet,
  rows: SourceKeywordRow[],
  resultMap: Map<string, CheckResult>
): Promise<number> => {
  const replacementGroups = groupOutputRows(buildWorkerOutputRows(rows, resultMap));
  const replacementByKeyword = new Map(
    replacementGroups.map((group) => [group.keyword, group])
  );

  await sheet.loadCells({
    startRowIndex: 1,
    endRowIndex: sheet.rowCount,
    startColumnIndex: 0,
    endColumnIndex: 4,
  });

  let currentKeyword = '';
  let changedCount = 0;
  const usedReplacementRows = new Map<string, number>();

  for (let rowIndex = 1; rowIndex < sheet.rowCount; rowIndex += 1) {
    const keywordCell = sheet.getCell(rowIndex, 0);
    const keyword = normalizeCell(keywordCell.formattedValue ?? keywordCell.value);

    if (keyword) {
      currentKeyword = keyword;
      usedReplacementRows.set(currentKeyword, 0);
    }

    if (!currentKeyword) {
      continue;
    }

    const replacementGroup = replacementByKeyword.get(currentKeyword);

    if (!replacementGroup) {
      continue;
    }

    const linkCell = sheet.getCell(rowIndex, 3);
    const link = normalizeCell(linkCell.formattedValue ?? linkCell.value);

    if (!link) {
      continue;
    }

    const replacementStartIndex = usedReplacementRows.get(currentKeyword) ?? 0;
    const replacementIndex = replacementGroup.rows.findIndex(
      (row, index) => index >= replacementStartIndex && normalizeCell(row[3]) === link
    );

    if (replacementIndex < 0) {
      continue;
    }

    usedReplacementRows.set(currentKeyword, replacementIndex + 1);

    const nextRank = replacementGroup.rows[replacementIndex][2];
    const rankCell = sheet.getCell(rowIndex, 2);
    const currentRank = normalizeCell(rankCell.formattedValue ?? rankCell.value);

    if (currentRank !== normalizeCell(nextRank)) {
      rankCell.value = nextRank;
      changedCount += 1;
    }
  }

  if (changedCount > 0) {
    await saveUpdatedCellsWithRetry(sheet);
  }

  logger.info(`순위만 수정 완료: ${changedCount}셀`);

  return changedCount;
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(options.sheetId, auth);
  const outputSheet = await getOrCreateOutputWorksheet(
    doc,
    options.outputGid,
    options.outputTitle
  );
  const inputSheet =
    options.inputFromOutput || options.inputGid !== null || options.inputTitle
      ? options.inputFromOutput
        ? outputSheet
        : getWorksheetByGidOrTitle(doc, options.inputGid, options.inputTitle)
      : null;
  if (options.partialUpdate && options.keywordFilters.length === 0) {
    throw new Error('partial-update는 --keyword/--keywords와 함께 사용해야 함');
  }

  if (
    options.keywordFilters.length > 0 &&
    !options.dryRun &&
    !options.partialUpdate
  ) {
    throw new Error('키워드 필터 실행은 시트 덮어쓰기 방지를 위해 dry-run만 허용됨');
  }

  const allRows = inputSheet
    ? await loadKeywordsFromWorksheet(inputSheet, options.inputExposedOnly)
    : await loadOldLogicKeywords(auth, doc, options.sourceTabs);
  const selectedRows =
    options.keywordFilters.length > 0
      ? options.keywordFilters.map((keyword) => ({
          sourceTab: '시트' as const,
          company: '',
          keyword,
          rowNumber: 0,
        }))
      : allRows;
  const rows =
    options.limit > 0 ? selectedRows.slice(0, options.limit) : selectedRows;
  const targetByKey = new Map<string, ResolvedKeywordTarget>();
  rows.forEach((row) => {
    const target = resolveKeywordTarget(row);
    if (!targetByKey.has(target.targetKey)) {
      targetByKey.set(target.targetKey, target);
    }
  });
  const uniqueTargets = Array.from(targetByKey.values());
  const keywordNeededCounts = rows.reduce((countMap, row) => {
    const targetKey = resolveKeywordTarget(row).targetKey;
    countMap.set(targetKey, (countMap.get(targetKey) ?? 0) + 1);

    return countMap;
  }, new Map<string, number>());
  const sourceLabel = inputSheet
    ? `시트:${inputSheet.title}`
    : options.sourceTabs.join(', ');

  logger.summary.start('OLD LOGIC MORE-PAGE EXPOSURE CHECK', [
    { label: '대상 탭', value: sourceLabel },
    { label: '구로직 행', value: `${allRows.length}개` },
    { label: '실행 행', value: `${rows.length}개` },
    { label: '실제 요청 키워드', value: `${uniqueTargets.length}개` },
    { label: '결과 탭', value: outputSheet.title },
    {
      label: '모드',
      value: options.dryRun
        ? 'dry-run'
        : [
            options.allMatches ? 'all-matches' : '',
            options.externalBlogLimit > 0
              ? `external-${options.externalBlogLimit}`
              : '',
            options.rankOnly ? 'rank-only' : '',
            options.append ? 'append' : '',
            options.partialUpdate ? 'partial-update' : '',
          ]
            .filter(Boolean)
            .join('+') || 'write',
    },
    { label: '동시성', value: `${options.concurrency}` },
    {
      label: '체크포인트',
      value: options.useCheckpoint ? DEFAULT_CHECKPOINT_PATH : '사용 안 함',
    },
    { label: '더보기 최대 스크롤', value: `${options.maxScrolls}` },
    { label: '더보기 최대 결과', value: `${options.maxResults}개` },
    { label: '스크롤 안정 횟수', value: `${options.stableScrolls}` },
    { label: '수집 모드', value: options.mode },
    { label: '외부 블로그 수집', value: `${options.externalBlogLimit}개` },
    { label: '대상 블로그', value: describeTargetBlogIds(options) },
  ]);

  const browserContext = await launchBrowser();
  const resultMap = options.useCheckpoint ? loadCheckpoint() : new Map<string, CheckResult>();
  const pendingTargets = uniqueTargets.filter(
    (target) => !resultMap.has(target.targetKey)
  );
  let results: CheckResult[] = [];
  let completedTargets = uniqueTargets.length - pendingTargets.length;

  emitExposureProgress(
    process.env.EXPOSURE_PROGRESS_TARGET,
    completedTargets,
    uniqueTargets.length,
    'running'
  );

  logger.info(
    `체크포인트 재사용 ${uniqueTargets.length - pendingTargets.length}개, 신규 체크 ${pendingTargets.length}개`
  );

  try {
    const newResults = await runWithConcurrency(
      pendingTargets,
      options.concurrency,
      async (target, index) => {
        const targetBlogIds = getTargetBlogIdsForTarget(target, options);
        const targetBlogIdSet = new Set(targetBlogIds);
        const externalExcludedBlogIdSet = new Set([
          ...targetBlogIds,
          ...REMOVED_TARGET_BLOG_IDS,
        ]);
        const result = await checkKeyword(
          target.targetKey,
          target.outputKeyword,
          target.searchKeyword,
          target.vendorTarget,
          targetBlogIdSet,
          externalExcludedBlogIdSet,
          browserContext,
          options.allMatches
            ? Number.MAX_SAFE_INTEGER
            : keywordNeededCounts.get(target.targetKey) ?? 1,
          options.externalBlogLimit,
          options.maxScrolls,
          options.maxResults,
          options.stableScrolls,
          options.mode
        );
        const checkedText = result.checkedCount
          ? `, ${result.checkedCount}개 확인`
          : '';
        const scrollText = result.scrollEndReason
          ? `, 끝확인=${result.scrollEndReason}/${result.scrollCount}회`
          : '';
        const publishedAtText =
          result.exposed && result.postPublishedAt
            ? `, 작성일=${result.postPublishedAt}`
            : '';
        const status = result.exposed
          ? `o ${result.position}번째${checkedText}${publishedAtText}${scrollText}`
          : result.error
            ? `미노출 (${result.error})${scrollText}`
            : `미노출${checkedText}${scrollText}`;
        const searchText =
          result.searchKeyword && result.searchKeyword !== result.keyword
            ? ` (검색어=${result.searchKeyword}${
                result.vendorTarget ? `, 업체=${result.vendorTarget}` : ''
              })`
            : '';

        logger.info(
          `[${index + 1}/${pendingTargets.length}] ${target.outputKeyword}${searchText}: ${status}`
        );

        resultMap.set(target.targetKey, result);
        completedTargets += 1;
        emitExposureProgress(
          process.env.EXPOSURE_PROGRESS_TARGET,
          completedTargets,
          uniqueTargets.length,
          'running'
        );
        if (options.useCheckpoint) {
          saveCheckpoint(resultMap);
        }

        await randomDelay(1800, 3400);
        return result;
      }
    );
    newResults.forEach((result) => resultMap.set(result.targetKey, result));
  } finally {
    await closeBrowser();
  }
  results = uniqueTargets
    .map((target) => resultMap.get(target.targetKey))
    .filter((result): result is CheckResult => !!result);
  const workerOutputRows = buildWorkerOutputRows(rows, resultMap);
  const exposedCount = workerOutputRows.filter(
    ([, , , , , , , , status]) => status === '노출'
  ).length;
  const uniqueExposedCount = results.filter(
    (result) => getResultMatches(result).length > 0
  ).length;
  const errorCount = results.filter(({ error }) => error).length;
  const stableScrollCount = results.filter(
    ({ scrollEndReason }) => scrollEndReason === 'stable'
  ).length;
  const maxScrollCount = results.filter(
    ({ scrollEndReason }) => scrollEndReason === 'max-scrolls'
  ).length;
  const maxScrollResults = results.filter(
    ({ scrollEndReason }) => scrollEndReason === 'max-scrolls'
  );
  const publishedAtCount = workerOutputRows.filter(
    ([, , , , publishedAt, , , , status]) => status === '노출' && !!publishedAt
  ).length;
  const topPublishedAtCount = workerOutputRows.filter(
    ([, , , , , firstPublishedAt, secondPublishedAt, thirdPublishedAt]) =>
      !!firstPublishedAt || !!secondPublishedAt || !!thirdPublishedAt
  ).length;
  const notExposedCount = workerOutputRows.filter(
    ([, , , , , , , , status]) => status !== '노출'
  ).length;
  if (!options.dryRun && maxScrollResults.length > 0) {
    const sample = maxScrollResults
      .slice(0, 10)
      .map(({ keyword, checkedCount, scrollEndReason, error }) =>
        `${keyword}(${checkedCount}개, ${scrollEndReason || error})`
      )
      .join(', ');

    throw new Error(
      `스크롤 상한 도달 ${maxScrollResults.length}개 감지. 시트 쓰기 중단: ${sample}`
    );
  }

  if (!options.dryRun) {
    if (options.rankOnly) {
      await writeRankOnlyResults(outputSheet, rows, resultMap);
    } else {
      await writeResults(
        auth,
        options.sheetId,
        outputSheet,
        rows,
        resultMap,
        options.append,
        options.partialUpdate ? new Set(options.keywordFilters) : null
      );
    }
  }

  logger.summary.complete('OLD LOGIC MORE-PAGE EXPOSURE CHECK COMPLETE', [
    { label: '결과 행', value: `${workerOutputRows.length}개` },
    { label: '고유 키워드', value: `${uniqueTargets.length}개` },
    { label: '노출 행', value: `${exposedCount}개` },
    { label: '미노출/오류 행', value: `${notExposedCount}개` },
    { label: '노출 고유 키워드', value: `${uniqueExposedCount}개` },
    { label: '작성일 수집 행', value: `${publishedAtCount}개` },
    { label: '상위글 날짜 행', value: `${topPublishedAtCount}개` },
    { label: '에러/더보기 없음', value: `${errorCount}개` },
    { label: '스크롤 안정 종료', value: `${stableScrollCount}개` },
    { label: '스크롤 상한 도달', value: `${maxScrollCount}개` },
    {
      label: '시트 반영',
      value: options.dryRun ? '없음' : options.rankOnly ? '순위만 완료' : '완료',
    },
  ]);
};

main().catch((error) => {
  logger.error(
    `구로직 더보기 노출체크 실패: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
