/* Minimal batch runner for web UI; mirrors core logic in src/index.ts */
import { getAllKeywords, updateKeywordResult } from '../database';
import { crawlWithRetry, delay, fetchHtml } from '../crawler';
import { extractPopularItems } from '../parser';
import { matchBlogs, ExposureResult } from '../matcher';
import { NAVER_DESKTOP_HEADERS } from '../constants';
import * as cheerio from 'cheerio';

type AnyObj = Record<string, any>;

export interface BatchParams {
  startIndex?: number;
  limit?: number;
  onlySheetType?: string;
  onlyCompany?: string;
  onlyKeywordRegex?: string;
  allowAnyBlog?: boolean;
  maxContentChecks?: number;
  contentCheckDelay?: number;
}

export interface BatchItemResult {
  ok: boolean;
  keyword: string;
  restaurantName: string;
  topic: string;
  rank: number | null;
  blogId: string;
  blogName: string;
  postTitle: string;
  postLink: string;
  postVendorName: string;
  reason?: string;
}

const normalize = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '');

export async function runBatch(
  params: BatchParams
): Promise<{ total: number; processed: BatchItemResult[] }> {
  const startIndex = Math.max(0, Number(params.startIndex ?? 0));
  const limit = Math.max(1, Number(params.limit ?? 5));
  const allowAnyBlog = !!params.allowAnyBlog;
  const maxChecks = Math.max(1, Number(params.maxContentChecks ?? 3));
  const checkDelay = Math.max(0, Number(params.contentCheckDelay ?? 600));

  const allKeywords = await getAllKeywords();
  const norm = (v: any) =>
    String(v ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');

  let filtered: AnyObj[] = allKeywords as AnyObj[];
  if (params.onlySheetType)
    filtered = filtered.filter(
      (k) => norm(k.sheetType) === norm(params.onlySheetType)
    );
  if (params.onlyCompany)
    filtered = filtered.filter(
      (k) => norm(k.company) === norm(params.onlyCompany)
    );
  if (params.onlyKeywordRegex) {
    try {
      const re = new RegExp(params.onlyKeywordRegex);
      filtered = filtered.filter((k) => re.test(k.keyword));
    } catch {}
  }

  const keywords = filtered.slice(startIndex, startIndex + limit);
  const used = new Set<string>();
  const processed: BatchItemResult[] = [];

  for (let idx = 0; idx < keywords.length; idx++) {
    const doc = keywords[idx];
    const query = String(doc.keyword || '');
    const rnFromDoc = String(doc.restaurantName || '');
    const m = query.match(/\(([^)]+)\)/);
    const restaurantName = (rnFromDoc || (m ? m[1].trim() : '')).trim();
    const baseKeyword = query.replace(/\([^)]*\)/g, '').trim();
    const searchQuery = baseKeyword || query;

    try {
      const html = await crawlWithRetry(searchQuery, 3);
      const items = extractPopularItems(html);
      const allMatches = matchBlogs(query, items, { allowAnyBlog });
      let avail = allMatches.filter(
        (m) => !used.has(`${query}:${m.postTitle}`)
      );

      const makeOk = async (
        m: ExposureResult,
        matchedHtml?: string,
        postVendorName?: string
      ) => {
        used.add(`${query}:${m.postTitle}`);
        await updateKeywordResult(
          String(doc._id),
          true,
          m.topicName || m.exposureType,
          m.postLink,
          restaurantName,
          m.postTitle,
          matchedHtml || '',
          m.position,
          postVendorName || ''
        );
        processed.push({
          ok: true,
          keyword: query,
          restaurantName,
          topic: m.topicName || m.exposureType,
          rank: m.position ?? null,
          blogId: m.blogId,
          blogName: m.blogName,
          postTitle: m.postTitle,
          postLink: m.postLink,
          postVendorName: postVendorName || '',
        });
      };

      const makeFail = async (reason: string) => {
        await updateKeywordResult(
          String(doc._id),
          false,
          '',
          '',
          restaurantName,
          '',
          '',
          undefined,
          ''
        );
        processed.push({
          ok: false,
          keyword: query,
          restaurantName,
          topic: '',
          rank: null,
          blogId: '',
          blogName: '',
          postTitle: '',
          postLink: '',
          postVendorName: '',
          reason,
        });
      };

      if (restaurantName) {
        const rnNorm = normalize(restaurantName);
        const brandNorm = normalize(
          restaurantName
            .replace(/(본점|지점)$/u, '')
            .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
            .trim()
        );
        // Step 2: vendor-based
        let matched: ExposureResult | null = null;
        let matchedHtml = '';
        let postVendorName = '';
        for (let j = 0; j < avail.length && j < maxChecks; j++) {
          const cand = avail[j];
          try {
            const htmlCand = await fetchResolvedPostHtml(cand.postLink);
            const vendor = extractPostVendorName(htmlCand);
            if (vendor) {
              const vNorm = normalize(vendor);
              if (
                vNorm.includes(rnNorm) ||
                (brandNorm.length >= 2 && vNorm.includes(brandNorm))
              ) {
                matched = cand;
                matchedHtml = htmlCand;
                postVendorName = vendor;
                break;
              }
            }
          } catch {}
          if (j < avail.length - 1 && checkDelay > 0) await delay(checkDelay);
        }
        if (matched) {
          await makeOk(matched, matchedHtml, postVendorName);
          continue;
        }
        // Step 3: title fallback
        avail = avail.filter((m2) => {
          const title = String(m2.postTitle || '');
          const tnorm = normalize(title);
          return (
            tnorm.includes(rnNorm) ||
            (brandNorm.length >= 2 && tnorm.includes(brandNorm))
          );
        });
        if (avail.length > 0) {
          const pick = avail[0];
          let htmlPick = '';
          let vendor = '';
          try {
            htmlPick = await fetchResolvedPostHtml(pick.postLink);
            vendor = extractPostVendorName(htmlPick);
          } catch {}
          await makeOk(pick, htmlPick, vendor);
          continue;
        }
        await makeFail('NO_MATCH_AFTER_VENDOR_AND_TITLE');
      } else {
        // No restaurant: tokens must appear (with in-order fallback)
        const tokens = baseKeyword
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean);
        if (tokens.length > 0) {
          const tn = tokens.map((t) => normalize(t));
          let list = avail.filter((m2) => {
            const title = String(m2.postTitle || '');
            const raw = title.toLowerCase();
            const tnorm = normalize(title);
            return tn.every(
              (tt, i) =>
                raw.includes(tokens[i].toLowerCase()) || tnorm.includes(tt)
            );
          });
          if (list.length === 0 && tn.length >= 2) {
            const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fwd = new RegExp(tn.map((t) => esc(t)).join('.*'));
            const bwd = new RegExp(
              [...tn]
                .reverse()
                .map((t) => esc(t))
                .join('.*')
            );
            list = avail.filter((m2) => {
              const tnorm = normalize(String(m2.postTitle || ''));
              return fwd.test(tnorm) || bwd.test(tnorm);
            });
          }
          if (list.length > 0) {
            const pick = list[0];
            let htmlPick = '';
            let vendor = '';
            try {
              htmlPick = await fetchResolvedPostHtml(pick.postLink);
              vendor = extractPostVendorName(htmlPick);
            } catch {}
            await makeOk(pick, htmlPick, vendor);
            continue;
          }
        }
        await makeFail('NO_MATCH_TOKENS');
      }
      if (idx < keywords.length - 1) await delay(500);
    } catch (e) {
      await updateKeywordResult(
        String(doc._id),
        false,
        '',
        '',
        restaurantName,
        '',
        '',
        undefined,
        ''
      );
      processed.push({
        ok: false,
        keyword: query,
        restaurantName,
        topic: '',
        rank: null,
        blogId: '',
        blogName: '',
        postTitle: '',
        postLink: '',
        postVendorName: '',
        reason: 'ERROR',
      });
    }
  }

  return { total: processed.length, processed };
}

function extractPostVendorName(html: string): string {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    const t = $('.se-oglink-title').first().text().trim();
    if (t) {
      if (t.includes('네이버')) {
        const s = $('.se-oglink-summary').first().text().trim();
        const raw = s || t;
        const parts = raw.split(/\s*[:\-]\s*/);
        const head = (parts[0] || '').trim();
        return head || raw;
      }
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
        } catch {}
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
