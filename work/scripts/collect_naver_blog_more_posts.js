#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BLOGS = [
  { sheetName: '제이제이', displayName: '제이제이 (26.06.15 만료)', blogId: 'dnation09' },
  { sheetName: '철인삼남매', displayName: '철인삼남매 (25.12.12 만료)', blogId: 'dreamclock33' },
  { sheetName: '사랑채마켓', displayName: '사랑채마켓 (26.06.30 만료)', blogId: 'sarangchai_' },
  { sheetName: '호이호이', displayName: '호이호이 (영구-단체전환)', blogId: 'sw078' },
];

const OUT_DIR = path.join('outputs', 'blog-published-ranks');
const MAX_SCROLLS = Number(process.env.MAX_SCROLLS || 260);
const STABLE_SCROLL_LIMIT = 8;
const CUTOFF = new Date('2026-03-29T00:00:00+09:00');

function kstNowString() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function parsePostDate(value, reference = new Date('2026-06-29T12:00:00+09:00')) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+09:00`);
  }
  match = text.match(/^(\d+)\s*시간 전$/);
  if (match) return new Date(reference.getTime() - Number(match[1]) * 60 * 60 * 1000);
  match = text.match(/^(\d+)\s*분 전$/);
  if (match) return new Date(reference.getTime() - Number(match[1]) * 60 * 1000);
  match = text.match(/^(\d+)\s*일 전$/);
  if (match) return new Date(reference.getTime() - Number(match[1]) * 24 * 60 * 60 * 1000);
  if (text === '어제') return new Date(reference.getTime() - 24 * 60 * 60 * 1000);
  return null;
}

function outputName() {
  const now = new Date();
  const stamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now).replace(/[-: ]/g, '');
  return `target-blog-more-ui-posts-${stamp}.json`;
}

async function extractCards(page, blog) {
  return page.evaluate((blogId) => {
    const cards = Array.from(document.querySelectorAll('[data-ui-name="list"] .card__reUkU'));
    return cards.map((card) => {
      const time = card.querySelector('.time__Uowk3')?.textContent?.trim() || '';
      const title = card.querySelector('.title__UUn4H')?.textContent?.trim() || '';
      const text = card.querySelector('.text__AYhOA')?.textContent?.trim() || '';
      const link = card.querySelector('a[href*="PostView.naver"][data-click-area="pls.cardpost"]')
        || card.querySelector('a[href*="PostView.naver"]');
      const href = link?.href || '';
      const parsed = new URL(href, location.href);
      const logNo = parsed.searchParams.get('logNo') || '';
      const parsedBlogId = parsed.searchParams.get('blogId') || blogId;
      return {
        title,
        text,
        time,
        href,
        blogId: parsedBlogId,
        logNo,
      };
    }).filter((row) => row.title && row.logNo);
  }, blog.blogId);
}

async function collectBlog(browser, blog) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const url = `https://m.blog.naver.com/PostList.naver?blogId=${encodeURIComponent(blog.blogId)}&tab=1`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('[data-ui-name="list"] .card__reUkU', { timeout: 30000 });
  await page.waitForTimeout(1200);

  const byLogNo = new Map();
  let stableScrolls = 0;
  let previousCount = 0;
  let oldestLoaded = null;
  let scrollCount = 0;

  for (let i = 0; i < MAX_SCROLLS; i += 1) {
    const cards = await extractCards(page, blog);
    for (const card of cards) {
      if (!byLogNo.has(card.logNo)) {
        byLogNo.set(card.logNo, card);
      }
    }

    const dates = Array.from(byLogNo.values())
      .map((row) => parsePostDate(row.time))
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime());
    oldestLoaded = dates[0] || oldestLoaded;

    if (oldestLoaded && oldestLoaded < CUTOFF && byLogNo.size >= 20) {
      break;
    }

    if (byLogNo.size === previousCount) {
      stableScrolls += 1;
    } else {
      stableScrolls = 0;
      previousCount = byLogNo.size;
    }
    if (stableScrolls >= STABLE_SCROLL_LIMIT) {
      break;
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(850);
    scrollCount = i + 1;
  }

  const rows = Array.from(byLogNo.values()).map((row, index) => ({
    '순위': String(index + 1),
    '글': row.title,
    '링크': `https://blog.naver.com/${blog.blogId}/${row.logNo}`,
    '키워드': row.title,
    '발행일': row.time,
    '블로그': blog.displayName,
    '블로그ID': blog.blogId,
    '글번호': row.logNo,
    '매칭': '모바일 블로그 더보기',
    '비고': `uiScrolls=${scrollCount}`,
  }));

  await page.close();
  return {
    ...blog,
    rows,
    loadedCount: rows.length,
    oldestLoaded: oldestLoaded ? oldestLoaded.toISOString() : null,
    scrollCount,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const blog of BLOGS) {
      console.error(`[collect] ${blog.sheetName} ${blog.blogId}`);
      const result = await collectBlog(browser, blog);
      console.error(`[collect] ${blog.sheetName} rows=${result.rows.length} oldest=${result.oldestLoaded} scrolls=${result.scrollCount}`);
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    generatedAtKst: kstNowString(),
    rankingBasis: 'm.blog.naver.com PostList 실제 화면 스크롤/더보기 로드 기준',
    keywordBasis: '모바일 블로그 전체글 카드 제목',
    cutoffDateKst: '2026-03-29',
    headers: ['순위', '글', '링크', '키워드', '발행일', '블로그', '블로그ID', '글번호', '매칭', '비고'],
    results,
    summary: results.map((item) => ({
      sheetName: item.sheetName,
      blogId: item.blogId,
      rows: item.rows.length,
      oldestLoaded: item.oldestLoaded,
      scrollCount: item.scrollCount,
    })),
  };

  const outPath = path.join(OUT_DIR, outputName());
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(outPath);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
