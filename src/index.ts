import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllKeywords,
  updateKeywordResult,
} from './database';
import { crawlWithRetry, delay, fetchHtml } from './crawler';
import * as cheerio from 'cheerio';
import { extractPopularItems } from './parser';
import { matchBlogs, ExposureResult } from './matcher';
import { saveToCSV } from './csv-writer';
import { getSheetOptions, normalizeSheetType } from './sheet-config';
import { NAVER_DESKTOP_HEADERS } from './constants';
import { getSearchQuery } from './utils';

dotenv.config();

interface Config {
  maxRetries: number;
  delayBetweenQueries: number;
}

const config: Config = {
  maxRetries: 3,
  delayBetweenQueries: 100,
};

export async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  const allKeywords = await getAllKeywords();

  const onlySheetType = (process.env.ONLY_SHEET_TYPE || '').trim();
  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

  let filtered = allKeywords;
  const normalize = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');
  if (onlySheetType)
    filtered = filtered.filter(
      (k: any) => normalize(k.sheetType) === normalize(onlySheetType)
    );
  if (onlyCompany)
    filtered = filtered.filter(
      (k: any) => normalize(k.company) === normalize(onlyCompany)
    );
  if (onlyKeywordRegex) {
    try {
      const re = new RegExp(onlyKeywordRegex);
      filtered = filtered.filter((k: any) => re.test(k.keyword));
    } catch {}
  }
  if (onlyId) {
    filtered = filtered.filter((k: any) => String(k._id) === onlyId);
  }

  const startIndexRaw = Number(process.env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexRaw)
    ? Math.max(0, Math.min(startIndexRaw, filtered.length))
    : 0;

  const keywords = filtered.slice(startIndex);
  console.log(
    `📋 검색어 ${keywords.length}개 처리 예정 (필터 applied, start=${startIndex})\n`
  );

  const allResults: ExposureResult[] = [];
  const usedCombinations = new Set<string>();

  for (let i = 0; i < keywords.length; i++) {
    const keywordDoc = keywords[i];
    const query = keywordDoc.keyword;
    const sheetOpts = getSheetOptions((keywordDoc as any).sheetType);

    // 1) 우선 괄호로 들어온 업장명
    const restaurantName =
      String((keywordDoc as any).restaurantName || '').trim() ||
      (() => {
        const m = (query || '').match(/\(([^)]+)\)/);
        return m ? m[1].trim() : '';
      })();

    // 2) 시트타입/업체명 기반 보정 타겟
    const companyRaw = String((keywordDoc as any).company || '').trim();
    const sheetTypeCanon = normalizeSheetType(
      (keywordDoc as any).sheetType || ''
    );
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const companyNorm = norm(companyRaw);
    const vendorBrand = companyNorm.includes(norm('서리펫'))
      ? '서리펫'
      : sheetTypeCanon === 'dogmaru'
      ? '도그마루'
      : '';
    // 서리펫은 업체명 변수(브랜드)를 최우선으로 사용, 그 외에는 (업장명) → 브랜드 순서
    let vendorTarget =
      vendorBrand === '서리펫' ? '서리펫' : restaurantName || vendorBrand;

    const baseKeyword = getSearchQuery(query || '');

    try {
      const searchQuery =
        baseKeyword && baseKeyword.length > 0
          ? baseKeyword
          : getSearchQuery(query || '');
      const html = await crawlWithRetry(searchQuery, config.maxRetries);
      const items = extractPopularItems(html);
      // Per-sheet option with env override
      const allowAnyEnv = String(
        process.env.ALLOW_ANY_BLOG || ''
      ).toLowerCase();
      const allowAnyBlog =
        allowAnyEnv === 'true'
          ? true
          : allowAnyEnv === '1'
          ? true
          : allowAnyEnv === 'false'
          ? false
          : allowAnyEnv === '0'
          ? false
          : !!sheetOpts.allowAnyBlog;
      const allMatches = matchBlogs(query, items, { allowAnyBlog });
      console.log(`[MATCH] allMatches: ${allMatches.length}개`);
      allMatches.forEach((m, idx) => {
        console.log(
          `  ${idx + 1}. ${m.blogName} - ${m.postTitle.substring(0, 50)}...`
        );
      });

      // Check if it's popular (single group) or smart blog (multiple groups)
      const uniqueGroups = new Set(items.map((item) => item.group));
      const isPopular = uniqueGroups.size === 1;
      console.log(
        `[TYPE] ${
          isPopular
            ? '인기글 (단일 그룹)'
            : `스블 (${uniqueGroups.size}개 주제)`
        }`
      );

      // Duplicates filtered first
      let availableMatches = allMatches.filter((match) => {
        const combination = `${query}:${match.postTitle}`;
        return !usedCombinations.has(combination);
      });
      console.log(
        `[MATCH] availableMatches (중복 제거 후): ${availableMatches.length}개`
      );

      const beforeTitleFilter = [...availableMatches];
      let matchSource: 'VENDOR' | 'TITLE' | '' = '';

      if (vendorTarget) {
        // 2-step: (1) try vendor from HTML via se-oglink-summary/se-map-title, (2) fallback to title
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
        const rn = vendorTarget.toLowerCase();
        const rnNorm = normalize(vendorTarget);
        const baseBrandNorm = normalize(
          vendorTarget
            .replace(/(본점|지점)$/u, '')
            .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
            .trim()
        );

        const maxChecksEnv = Number(process.env.MAX_CONTENT_CHECKS);
        const delayMsEnv = Number(process.env.CONTENT_CHECK_DELAY_MS);
        const configuredMaxChecks = Number.isFinite(maxChecksEnv)
          ? Math.max(1, maxChecksEnv)
          : Math.max(1, Number(sheetOpts.maxContentChecks));

        // 스블(여러 주제)일 때는 maxChecks 무시, 인기글(단일 그룹)일 때만 적용
        const maxChecks = isPopular
          ? configuredMaxChecks
          : availableMatches.length;

        const delayMs = Number.isFinite(delayMsEnv)
          ? Math.max(0, delayMsEnv)
          : Math.max(0, Number(sheetOpts.contentCheckDelayMs));
        const brandRoot = normalize(
          (restaurantName.split(/\s+/)[0] || '').trim()
        );
        console.log(brandRoot);
        let matched: ExposureResult | null = null;
        let matchedHtml = '';
        let postVendorName = '';

        for (let j = 0; j < availableMatches.length && j < maxChecks; j++) {
          const cand = availableMatches[j];
          try {
            const htmlCand = await fetchResolvedPostHtml(cand.postLink);
            const vendor = extractPostVendorName(htmlCand);
            if (vendor) {
              const vNorm = normalize(vendor);
              const check1 = vNorm.includes(rnNorm);
              const check2 =
                baseBrandNorm.length >= 2 && vNorm.includes(baseBrandNorm);
              const check3 = brandRoot.length >= 2 && vNorm.includes(brandRoot);

              const ok = check1 || check2 || check3;

              if (ok) {
                matched = cand;
                matchedHtml = htmlCand;
                postVendorName = vendor;
                break;
              }
            } else {
              console.warn(`  → No vendor found in HTML`);
            }
          } catch (err) {
            console.error(`  → Error: ${(err as Error).message}`);
          }
          if (j < availableMatches.length - 1 && delayMs > 0) {
            await delay(delayMs);
          }
        }

        if (matched) {
          const combination = `${query}:${matched.postTitle}`;
          usedCombinations.add(combination);

          const displayRestaurant = vendorTarget || '-';
          const displayRank = matched.position ?? '-';
          const displayTitle = matched.postTitle || '-';
          const displayTopic = matched.topicName || matched.exposureType || '-';
          const displayVendor = postVendorName || '-';
          console.log(
            `[${i + 1}/${
              keywords.length
            }] ${query} ✅ ${displayRestaurant} / ${displayRank} / ${displayTopic} / ${displayVendor} / ${displayTitle} / SRC=VENDOR`
          );

          await updateKeywordResult(
            String(keywordDoc._id),
            true,
            matched.topicName || matched.exposureType,
            matched.postLink,
            vendorTarget,
            matched.postTitle,
            matchedHtml,
            matched.position, // rank
            postVendorName
          );

          allResults.push(matched);
          if (i < keywords.length - 1) {
            await delay(config.delayBetweenQueries);
          }
          continue; // go next keyword
        }

        // 3rd fallback: title-only check when vendor selectors were not usable
        availableMatches = availableMatches.filter((m) => {
          const titleRaw = m.postTitle || '';
          const title = titleRaw.toLowerCase();
          const titleNorm = normalize(titleRaw);
          const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
          const hasBrand =
            (baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm)) ||
            (brandRoot.length >= 2 && titleNorm.includes(brandRoot));
          return hasFull || hasBrand;
        });
        if (availableMatches.length > 0) {
          matchSource = 'TITLE';
        }
      } else {
        // No restaurant qualifier: require that all base keyword tokens appear in title (space-insensitive)
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
        const tokens = baseKeyword
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        if (tokens.length > 0) {
          availableMatches = availableMatches.filter((m) => {
            const titleRaw = m.postTitle || '';
            const title = titleRaw.toLowerCase();
            const titleNorm = normalize(titleRaw);
            return tokens.every((tok) => {
              const tLower = tok.toLowerCase();
              return (
                title.includes(tLower) || titleNorm.includes(normalize(tok))
              );
            });
          });

          // Fallback: tokens-in-order regex on normalized title (handles insertions like "수원역고기맛집")
          if (availableMatches.length === 0 && tokens.length >= 2) {
            const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const tnorm = tokens.map((t) =>
              esc(t.toLowerCase().replace(/\s+/g, ''))
            );
            const forward = new RegExp(tnorm.join('.*'));
            const backward = new RegExp([...tnorm].reverse().join('.*'));
            availableMatches = beforeTitleFilter.filter((m) => {
              const titleNorm = normalize(m.postTitle || '');
              return forward.test(titleNorm) || backward.test(titleNorm);
            });
          }
        }
      }

      if (availableMatches.length > 0) {
        const firstMatch = availableMatches[0];
        const combination = `${query}:${firstMatch.postTitle}`;
        usedCombinations.add(combination);

        let matchedHtml = '';
        let postVendorName = '';
        try {
          matchedHtml = await fetchResolvedPostHtml(firstMatch.postLink);
          postVendorName = extractPostVendorName(matchedHtml);
        } catch (_) {
          matchedHtml = '';
        }

        const displayRestaurant = restaurantName || '-';
        const displayRank = firstMatch.position ?? '-';
        const displayTitle = firstMatch.postTitle || '-';
        const displayTopic =
          firstMatch.topicName || firstMatch.exposureType || '-';
        const displayVendor = postVendorName || '-';
        const srcInfo = matchSource ? ` / SRC=${matchSource}` : '';
        console.log(
          `[${i + 1}/${
            keywords.length
          }] ${query} ✅ ${displayRestaurant} / ${displayRank} / ${displayTopic} / ${displayVendor} / ${displayTitle}${srcInfo}`
        );

        await updateKeywordResult(
          String(keywordDoc._id),
          true,
          firstMatch.topicName || firstMatch.exposureType,
          firstMatch.postLink,
          restaurantName,
          firstMatch.postTitle,
          matchedHtml,
          firstMatch.position, // rank
          postVendorName
        );

        allResults.push(firstMatch);
      } else {
        const displayRestaurant = restaurantName || '-';
        console.log(
          `[${i + 1}/${
            keywords.length
          }] ${query} ❌ ${displayRestaurant} / - / - / - / -`
        );

        await updateKeywordResult(
          String(keywordDoc._id),
          false,
          '',
          '',
          restaurantName,
          '',
          '',
          undefined,
          ''
        );
      }

      if (i < keywords.length - 1) {
        await delay(config.delayBetweenQueries);
      }
    } catch (error) {
      const displayRestaurant = restaurantName || '-';
      console.log(
        `[${i + 1}/${
          keywords.length
        }] ${query} ❌ ${displayRestaurant} / - / - / - / - (에러)`
      );
      await updateKeywordResult(
        String(keywordDoc._id),
        false,
        '',
        '',
        restaurantName,
        '',
        '',
        undefined,
        ''
      );
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filterSheet = (process.env.ONLY_SHEET_TYPE || '').trim();
  const csvPrefix = filterSheet
    ? getSheetOptions(filterSheet).csvFilePrefix
    : 'results';
  const filename = `${csvPrefix}_${timestamp}.csv`;

  saveToCSV(allResults, filename);

  console.log('\n' + '='.repeat(50));
  console.log('📊 크롤링 완료 요약');
  console.log('='.repeat(50));
  console.log(`✅ 총 검색어: ${keywords.length}개`);
  console.log(`✅ 총 노출 발견: ${allResults.length}개`);
  console.log(
    `✅ 인기글: ${
      allResults.filter((r) => r.exposureType === '인기글').length
    }개`
  );
  console.log(
    `✅ 스블: ${allResults.filter((r) => r.exposureType === '스블').length}개`
  );
  console.log('='.repeat(50) + '\n');

  await disconnectDB();
}

function extractPostVendorName(html: string): string {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    // 1) Prefer se-oglink-title first
    const titleText = $('.se-oglink-title').first().text().trim();
    if (titleText) {
      // Exact "네이버 지도" → rely on summary as-is
      if (titleText === '네이버 지도') {
        const summaryText = $('.se-oglink-summary').first().text().trim();
        return summaryText || titleText;
      }
      // Pattern like "가게명 : 네이버" → extract left part
      const m = titleText.match(/^(.+?)\s*:\s*네이버\s*$/);
      if (m) return (m[1] || '').trim();
      // Fallback: split by common delimiters
      const parts = titleText.split(/\s*[:\-]\s*/);
      const head = (parts[0] || '').trim();
      return head || titleText;
    }
    // 2) Fallback to se-map-title
    const mapText = $('.se-map-title').first().text().trim();
    if (!mapText) return '';
    const parts = mapText.split(/\s*[:\-]\s*/);
    const head = (parts[0] || '').trim();
    return head || mapText;
  } catch {
    return '';
  }
}

async function fetchResolvedPostHtml(url: string): Promise<string> {
  try {
    const outer = await fetchHtml(url, NAVER_DESKTOP_HEADERS);
    // Naver desktop blog often loads content inside #mainFrame iframe
    if (outer && outer.includes('id="mainFrame"')) {
      const $ = cheerio.load(outer);
      const src = $('#mainFrame').attr('src') || '';
      if (src) {
        const abs = new URL(src, url).toString();
        try {
          const inner = await fetchHtml(abs, NAVER_DESKTOP_HEADERS);
          if (containsVendorSelectors(inner)) return inner;
          // fallback to mobile if still not present
          const murl = buildMobilePostUrl(url, abs);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl, NAVER_DESKTOP_HEADERS);
              if (containsVendorSelectors(mhtml)) return mhtml;
            } catch {}
          }
          return inner || outer;
        } catch {
          // try mobile directly
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
    // If no iframe, but vendor selector missing, try mobile variant too
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
      if (blogId && logNo) {
        return `https://m.blog.naver.com/${blogId}/${logNo}`;
      }
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
    // pattern 1: https://blog.naver.com/{blogId}/{logNo}
    const path = url.pathname.replace(/^\/+/, '').split('/');
    if (path.length >= 2 && path[0] !== 'PostView.naver') {
      const blogId = path[0];
      const logNo = path[1];
      if (blogId && logNo) return { blogId, logNo };
    }
    // pattern 2: PostView.naver?blogId=...&logNo=...
    if (url.pathname.includes('PostView.naver')) {
      const blogId = url.searchParams.get('blogId');
      const logNo = url.searchParams.get('logNo');
      return { blogId, logNo };
    }
  } catch {}
  return { blogId: null, logNo: null };
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 프로그램 오류:', error);
    process.exit(1);
  });
}
