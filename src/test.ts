import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import { crawlWithRetry, fetchHtml, delay } from './crawler';
import { getSearchQuery } from './utils';
import { extractPopularItems } from './parser';
import { matchBlogs, ExposureResult, extractBlogId } from './matcher';

import { connectDB, disconnectDB, getAllKeywords } from './database';

dotenv.config();

// 테스트 실행 진입점: 키워드 인자 있으면 노출체크 단일 실행, 없으면 DB 연결 스모크
(async () => {
  const args = process.argv.slice(2);
  const hasKeywordArg = args.length > 0 && !args[0].startsWith('-');

  if (hasKeywordArg) {
    const keyword = args.join(' ').trim();
    await runExposureCheck(keyword);
  } else {
    await testMongoDBFetch();
  }
})();

async function runExposureCheck(queryRaw: string) {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const extractParen = (q: string) => {
    const m = (q || '').match(/\(([^)]+)\)/);
    return m ? m[1].trim() : '';
  };

  const restaurantName = extractParen(queryRaw);
  const baseKeyword = getSearchQuery(queryRaw || '');
  const searchQuery =
    baseKeyword && baseKeyword.length > 0
      ? baseKeyword
      : getSearchQuery(queryRaw || '');

  const allowAnyBlog =
    String(process.env.ALLOW_ANY_BLOG || '').toLowerCase() === 'true' ||
    String(process.env.ALLOW_ANY_BLOG || '') === '1';
  const maxChecks = Number(process.env.MAX_CONTENT_CHECKS || '3');
  const delayMs = Number(process.env.CONTENT_CHECK_DELAY_MS || '600');

  console.log(
    `\n🔎 테스트 검색어: "${queryRaw}" (실제 검색: "${searchQuery}")`
  );
  if (restaurantName) console.log(`🍽️ 괄호 내 업장: "${restaurantName}"`);

  try {
    const html = await crawlWithRetry(searchQuery, 2);
    const items = extractPopularItems(html);
    const matches = matchBlogs(queryRaw, items, { allowAnyBlog });

    if (matches.length === 0) {
      console.log('❌ 매칭 결과 없음 (허용된 블로그 ID 기준).');
      return;
    }

    // 업장명이 제공된 경우: 포스트 내부에서 벤더명 확인
    if (restaurantName) {
      const rn = restaurantName.toLowerCase();
      const rnNorm = normalize(restaurantName);
      const baseBrandNorm = normalize(
        restaurantName
          .replace(/(본점|지점)$/u, '')
          .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
          .trim()
      );
      const brandRoot = normalize(
        (restaurantName.split(/\s+/)[0] || '').trim()
      );

      let matched: ExposureResult | null = null;
      let matchedHtml = '';
      let postVendorName = '';

      for (let i = 0; i < matches.length && i < maxChecks; i++) {
        const cand = matches[i];
        try {
          const htmlCand = await fetchResolvedPostHtml(cand.postLink);
          const vendor = extractPostVendorName(htmlCand);
          if (vendor) {
            const vNorm = normalize(vendor);
            const ok =
              vNorm.includes(rnNorm) ||
              (baseBrandNorm.length >= 2 && vNorm.includes(baseBrandNorm)) ||
              (brandRoot.length >= 2 && vNorm.includes(brandRoot));
            if (ok) {
              matched = cand;
              matchedHtml = htmlCand;
              postVendorName = vendor;
              break;
            }
          }
        } catch {}
        if (i < matches.length - 1 && delayMs > 0) await delay(delayMs);
      }

      if (matched) {
        console.log(
          `✅ 노출 확인 (VENDOR): ${restaurantName} / ${
            matched.position ?? '-'
          } / ${
            matched.topicName || matched.exposureType || '-'
          } / ${postVendorName} / ${matched.postTitle}`
        );
        console.log(`🔗 ${matched.postLink}`);
        return;
      }

      // 벤더매칭 실패 시 타이틀 매칭 폴백
      const titleFiltered = matches.filter((m) => {
        const titleRaw = m.postTitle || '';
        const title = titleRaw.toLowerCase();
        const titleNorm = normalize(titleRaw);
        const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
        const hasBrand =
          (baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm)) ||
          (brandRoot.length >= 2 && titleNorm.includes(brandRoot));
        return hasFull || hasBrand;
      });

      if (titleFiltered.length > 0) {
        const first = titleFiltered[0];
        let vendorName = '';
        try {
          const htmlFirst = await fetchResolvedPostHtml(first.postLink);
          vendorName = extractPostVendorName(htmlFirst);
        } catch {}
        console.log(
          `✅ 노출 확인 (TITLE): ${restaurantName} / ${
            first.position ?? '-'
          } / ${first.topicName || first.exposureType || '-'} / ${
            vendorName || '-'
          } / ${first.postTitle}`
        );
        console.log(`🔗 ${first.postLink}`);
        return;
      }

      console.log('❌ 노출 없음 (업장명 기준).');
      return;
    }

    // 업장명 미지정: 첫 매치만 리포트
    const first = matches[0];
    let vendorName = '';
    try {
      const htmlFirst = await fetchResolvedPostHtml(first.postLink);
      vendorName = extractPostVendorName(htmlFirst);
    } catch {}
    console.log(
      `✅ 노출 확인: - / ${first.position ?? '-'} / ${
        first.topicName || first.exposureType || '-'
      } / ${vendorName || '-'} / ${first.postTitle}`
    );
    console.log(`🔗 ${first.postLink}`);
  } catch (e) {
    console.error('❌ 테스트 실행 중 오류:', e);
  }
}

// 기존 DB 스모크 (키워드 없을 때만 수행)
async function testMongoDBFetch() {
  console.log('🚀 MongoDB 데이터 가져오기 테스트\n');

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다');
    }

    await connectDB(uri);

    const keywords = await getAllKeywords();

    console.log(`\n📊 총 ${keywords.length}개 키워드 발견\n`);

    if (keywords.length > 0) {
      console.log('📝 키워드 목록:\n');
      keywords.forEach((kw, idx) => {
        console.log(`${idx + 1}. ${kw.keyword}`);
        console.log(`   회사: ${kw.company}`);
        console.log(
          `   노출 여부: ${kw.visibility ? '✅ 노출됨' : '❌ 노출 안됨'}`
        );
        console.log(`   인기주제: ${kw.popularTopic || '(없음)'}`);
        console.log(`   URL: ${kw.url || '(없음)'}`);
        console.log(`   시트타입: ${kw.sheetType}`);
        console.log(
          `   마지막 체크: ${kw.lastChecked.toLocaleString('ko-KR')}`
        );
        console.log('');
      });
    }

    await disconnectDB();

    console.log('✅ 테스트 완료!');
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// 내부 포스트 HTML에서 업장명 추출 (index.ts와 동일 로직 복사)
function extractPostVendorName(html: string): string {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    const titleText = $('.se-oglink-title').first().text().trim();
    if (titleText) {
      if (titleText === '네이버 지도') {
        const summaryText = $('.se-oglink-summary').first().text().trim();
        return summaryText || titleText;
      }
      const m = titleText.match(/^(.+?)\s*:\s*네이버\s*$/);
      if (m) return (m[1] || '').trim();
      const parts = titleText.split(/\s*[:\-]\s*/);
      const head = (parts[0] || '').trim();
      return head || titleText;
    }
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
    const outer = await fetchHtml(url);
    if (outer && outer.includes('id="mainFrame"')) {
      const $ = cheerio.load(outer);
      const src = $('#mainFrame').attr('src') || '';
      if (src) {
        const abs = new URL(src, url).toString();
        try {
          const inner = await fetchHtml(abs);
          if (containsVendorSelectors(inner)) return inner;
          const murl = buildMobilePostUrl(url, abs);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl);
              if (containsVendorSelectors(mhtml)) return mhtml;
            } catch {}
          }
          return inner || outer;
        } catch {
          const murl = buildMobilePostUrl(url, src);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl);
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
          const mhtml = await fetchHtml(murl);
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
