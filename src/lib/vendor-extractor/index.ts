import * as cheerio from 'cheerio';
import { fetchHtml } from '../../crawler';

/**
 * 네이버 블로그 포스트 HTML에서 모든 업체명(가게명) 추출 (배열)
 */
export function extractPostVendorNames(html: string): string[] {
  if (!html) return [];
  try {
    const $ = cheerio.load(html);
    const vendors: string[] = [];

    // 1) se-oglink-title (OG 링크)
    $('.se-oglink-title').each((_, el) => {
      const titleText = $(el).text().trim();
      if (!titleText) return;

      const titleNorm = titleText.replace(/\s+/g, '');
      if (titleNorm === '네이버지도') {
        // 네이버 지도 링크면 summary에서 업체명 추출
        const summaryText = $(el)
          .closest('.se-oglink-info')
          .find('.se-oglink-summary')
          .first()
          .text()
          .trim();
        if (summaryText) vendors.push(summaryText);
      } else {
        // "가게명 : 네이버" 패턴 처리
        const m = titleText.match(/^(.+?)\s*:\s*네이버\s*$/);
        if (m) {
          vendors.push((m[1] || '').trim());
        } else {
          const parts = titleText.split(/\s*[:\-]\s*/);
          const head = (parts[0] || '').trim();
          vendors.push(head || titleText);
        }
      }
    });

    // 2) se-map-title (지도 컴포넌트)
    $('.se-map-title').each((_, el) => {
      const mapText = $(el).text().trim();
      if (!mapText) return;
      const parts = mapText.split(/\s*[:\-]\s*/);
      const head = (parts[0] || '').trim();
      vendors.push(head || mapText);
    });

    // 중복 제거
    return [...new Set(vendors)];
  } catch {
    return [];
  }
}

/**
 * 네이버 블로그 포스트 HTML에서 업체명(가게명) 추출 (첫 번째만)
 * @deprecated extractPostVendorNames 사용 권장
 */
export function extractPostVendorName(html: string): string {
  const vendors = extractPostVendorNames(html);
  return vendors[0] || '';
}

/**
 * 블로그 포스트 URL에서 실제 컨텐츠 HTML 가져오기 (iframe, 모바일 페이지 처리 포함)
 */
export async function fetchResolvedPostHtml(url: string): Promise<string> {
  try {
    const outer = await fetchHtml(url);
    // Naver desktop blog often loads content inside #mainFrame iframe
    if (outer && outer.includes('id="mainFrame"')) {
      const $ = cheerio.load(outer);
      const src = $('#mainFrame').attr('src') || '';
      if (src) {
        const abs = new URL(src, url).toString();
        try {
          const inner = await fetchHtml(abs);
          if (containsVendorSelectors(inner)) return inner;
          // fallback to mobile if still not present
          const murl = buildMobilePostUrl(url, abs);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl);
              if (containsVendorSelectors(mhtml)) return mhtml;
            } catch {}
          }
          return inner || outer;
        } catch {
          // try mobile directly
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
    // If no iframe, but vendor selector missing, try mobile variant too
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
