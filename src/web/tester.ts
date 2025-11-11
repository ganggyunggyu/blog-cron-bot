import { NAVER_DESKTOP_HEADERS } from '../constants';
import { crawlWithRetry, fetchHtml } from '../crawler';
import { extractPopularItems } from '../parser';
import { matchBlogs, ExposureResult } from '../matcher';

export interface TestOptions {
  allowAnyBlog?: boolean;
  fetchHtml?: boolean;
  debug?: boolean;
}

export interface TestInput {
  keyword: string;
}

export interface TestResult {
  ok: boolean;
  query: string;
  baseKeyword: string;
  restaurantName: string;
  match?: ExposureResult;
  matchedHtml?: string;
  reasons?: string[];
  postVendorName?: string;
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export const testKeyword = async (
  input: TestInput,
  options: TestOptions = {}
): Promise<TestResult> => {
  const query = (input.keyword || '').trim();
  const m = query.match(/\(([^)]+)\)/);
  const restaurantName = m ? m[1].trim() : '';
  const baseKeyword = query.replace(/\([^)]*\)/g, '').trim();

  const searchQuery = baseKeyword || query;
  const html = await crawlWithRetry(searchQuery, 3);
  const items = extractPopularItems(html);
  const allMatches = matchBlogs(query, items, {
    allowAnyBlog: !!options.allowAnyBlog,
  });

  const used = new Set<string>();
  let available = allMatches.filter((match) => {
    const combo = `${query}:${match.postTitle}`;
    return !used.has(combo);
  });

  const beforeTitle = [...available];

  if (restaurantName) {
    const rn = restaurantName.toLowerCase();
    const rnNorm = normalize(restaurantName);
    const baseBrandNorm = normalize(
      restaurantName
        .replace(/(본점|지점)$/u, '')
        .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
        .trim()
    );

    available = available.filter((m2) => {
      const titleRaw = m2.postTitle || '';
      const title = titleRaw.toLowerCase();
      const titleNorm = normalize(titleRaw);
      const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
      const hasBrand =
        baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm);
      return hasFull || hasBrand;
    });
  } else {
    const tokens = baseKeyword
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tokens.length > 0) {
      available = available.filter((m2) => {
        const titleRaw = m2.postTitle || '';
        const title = titleRaw.toLowerCase();
        const titleNorm = normalize(titleRaw);
        return tokens.every((tok) => {
          const tLower = tok.toLowerCase();
          return title.includes(tLower) || titleNorm.includes(normalize(tok));
        });
      });

      if (available.length === 0 && tokens.length >= 2) {
        const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tnorm = tokens.map((t) =>
          esc(t.toLowerCase().replace(/\s+/g, ''))
        );
        const forward = new RegExp(tnorm.join('.*'));
        const backward = new RegExp([...tnorm].reverse().join('.*'));
        available = beforeTitle.filter((m2) => {
          const titleNorm = normalize(m2.postTitle || '');
          return forward.test(titleNorm) || backward.test(titleNorm);
        });
      }
    }
  }

  if (available.length > 0) {
    const first = available[0];
    used.add(`${query}:${first.postTitle}`);
    let matchedHtml = '';
    let postVendorName = '';
    try {
      const resolved = await fetchResolvedPostHtml(first.postLink);
      postVendorName = extractPostVendorName(resolved);
      if (options.fetchHtml) matchedHtml = resolved;
    } catch (_) {}
    return {
      ok: true,
      query,
      baseKeyword,
      restaurantName,
      match: first,
      matchedHtml,
      postVendorName,
    };
  }

  const result: TestResult = {
    ok: false,
    query,
    baseKeyword,
    restaurantName,
  };
  return result;
};

function extractPostVendorName(html: string): string {
  if (!html) return '';
  try {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const t = $('.se-oglink-title').first().text().trim();
    if (t) {
      if (t === '네이버 지도') {
        const s = $('.se-oglink-summary').first().text().trim();
        return s || t;
      }
      const m = t.match(/^(.+?)\s*:\s*네이버\s*$/);
      if (m) return (m[1] || '').trim();
      const parts = t.split(/\s*[:\-]\s*/);
      const head = (parts[0] || '').trim();
      return head || t;
    }
    const m = $('.se-map-title').first().text().trim();
    if (!m) return '';
    const parts = m.split(/\s*[:\-]\s*/);
    const head = (parts[0] || '').trim();
    return head || m;
  } catch {
    return '';
  }
}

async function fetchResolvedPostHtml(url: string): Promise<string> {
  try {
    const outer = await fetchHtml(url, NAVER_DESKTOP_HEADERS);
    if (outer && outer.includes('id="mainFrame"')) {
      const cheerio = require('cheerio');
      const $ = cheerio.load(outer);
      const src = $('#mainFrame').attr('src') || '';
      if (src) {
        const abs = new URL(src, url).toString();
        try {
          const inner = await fetchHtml(abs, NAVER_DESKTOP_HEADERS);
          if (containsVendorSelectors(inner)) return inner;
          const murl = buildMobilePostUrl(url, abs);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl, NAVER_DESKTOP_HEADERS);
              if (containsVendorSelectors(mhtml)) return mhtml;
            } catch {}
          }
          return inner || outer;
        } catch {
          const murl = buildMobilePostUrl(url, src);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl, NAVER_DESKTOP_HEADERS);
              if (containsVendorSelectors(mhtml)) return mhtml;
            } catch {}
          }
          return outer;
        }
      }
    }
    if (!containsVendorSelectors(outer)) {
      const murl = buildMobilePostUrl(url);
      if (murl) {
        try {
          const mhtml = await fetchHtml(murl, NAVER_DESKTOP_HEADERS);
          if (containsVendorSelectors(mhtml)) return mhtml;
        } catch {}
      }
    }
    return outer;
  } catch {
    return '';
  }
}

function containsVendorSelectors(html: string): boolean {
  if (!html) return false;
  try {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    return (
      $('.se-oglink-title').length > 0 ||
      $('.se-oglink-summary').length > 0 ||
      $('.se-map-title').length > 0
    );
  } catch {
    return false;
  }
}

function buildMobilePostUrl(
  originalUrl: string,
  fallbackUrl?: string
): string | null {
  try {
    const candidates = [originalUrl];
    if (fallbackUrl) candidates.push(fallbackUrl);
    for (const u of candidates) {
      const { blogId, logNo } = parseBlogParams(u);
      if (blogId && logNo) return `https://m.blog.naver.com/${blogId}/${logNo}`;
    }
  } catch {}
  return null;
}

function parseBlogParams(u: string): {
  blogId: string | null;
  logNo: string | null;
} {
  try {
    const url = new URL(u, 'https://blog.naver.com');
    const path = url.pathname.replace(/^\/+/, '').split('/');
    if (path.length >= 2 && path[0] !== 'PostView.naver') {
      const blogId = path[0];
      const logNo = path[1];
      if (blogId && logNo) return { blogId, logNo };
    }
    if (url.pathname.includes('PostView.naver')) {
      const blogId = url.searchParams.get('blogId');
      const logNo = url.searchParams.get('logNo');
      return { blogId, logNo };
    }
  } catch {}
  return { blogId: null, logNo: null };
}
