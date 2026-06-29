#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const INPUT_JSON = process.env.INPUT_JSON ||
  'outputs/blog-published-ranks/target-blog-posts-keyword-sheet-mar-jun-all-with-rank-20260629.json';
const OUT_DIR = process.env.OUT_DIR || 'outputs/blog-published-ranks';
const TOP_N = Number(process.env.TOP_N || 20);
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeNaverBlogUrl(raw) {
  if (!raw) return '';
  let value = String(raw).trim();
  try {
    const parsed = new URL(value, 'https://search.naver.com');
    const redirected = parsed.searchParams.get('u');
    if (redirected) value = decodeURIComponent(redirected);
  } catch {}

  try {
    const parsed = new URL(value, 'https://search.naver.com');
    let blogId = '';
    let logNo = '';

    if (parsed.hostname.includes('blog.naver.com')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'PostView.naver') {
        blogId = parsed.searchParams.get('blogId') || '';
        logNo = parsed.searchParams.get('logNo') || '';
      } else {
        blogId = parts[0] || '';
        logNo = parts[1] || '';
      }
    }

    if (blogId && logNo && /^\d+$/.test(logNo)) {
      return `https://blog.naver.com/${blogId}/${logNo}`;
    }
  } catch {}

  return '';
}

function collectTargets(payload) {
  const targetsByKeyword = new Map();
  for (const blog of payload.results || []) {
    for (const row of blog.rows || []) {
      const keyword = String(row['키워드'] || '').trim();
      const link = normalizeNaverBlogUrl(row['링크']);
      if (!keyword || !link) continue;
      if (!targetsByKeyword.has(keyword)) targetsByKeyword.set(keyword, new Set());
      targetsByKeyword.get(keyword).add(link);
    }
  }
  return Array.from(targetsByKeyword.entries()).map(([keyword, links]) => ({
    keyword,
    links: Array.from(links),
  }));
}

async function extractTopBlogLinks(page) {
  return page.evaluate((topN) => {
    function normalize(raw) {
      if (!raw) return '';
      let value = String(raw).trim();
      try {
        const parsed = new URL(value, location.href);
        const redirected = parsed.searchParams.get('u');
        if (redirected) value = decodeURIComponent(redirected);
      } catch {}
      try {
        const parsed = new URL(value, location.href);
        let blogId = '';
        let logNo = '';
        if (parsed.hostname.includes('blog.naver.com')) {
          const parts = parsed.pathname.split('/').filter(Boolean);
          if (parts[0] === 'PostView.naver') {
            blogId = parsed.searchParams.get('blogId') || '';
            logNo = parsed.searchParams.get('logNo') || '';
          } else {
            blogId = parts[0] || '';
            logNo = parts[1] || '';
          }
        }
        if (blogId && logNo && /^\d+$/.test(logNo)) {
          return `https://blog.naver.com/${blogId}/${logNo}`;
        }
      } catch {}
      return '';
    }

    const candidates = [];
    const seen = new Set();
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const anchor of anchors) {
      const link = normalize(anchor.href);
      if (!link || seen.has(link)) continue;
      const rect = anchor.getBoundingClientRect();
      const text = (anchor.innerText || anchor.textContent || '').trim();
      if (rect.width <= 0 || rect.height <= 0 || !text) continue;
      seen.add(link);
      candidates.push({ link, top: rect.top + window.scrollY, text });
    }
    candidates.sort((a, b) => a.top - b.top);
    return candidates.slice(0, topN).map((item, index) => ({
      rank: index + 1,
      link: item.link,
      text: item.text.slice(0, 120),
    }));
  }, TOP_N);
}

async function checkKeyword(context, target) {
  const page = await context.newPage();
  const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(target.keyword)}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 5; i += 1) {
      const links = await extractTopBlogLinks(page);
      if (links.length >= TOP_N) break;
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(500);
    }
    const topLinks = await extractTopBlogLinks(page);
    const rankByLink = {};
    for (const item of topLinks) {
      if (target.links.includes(item.link)) rankByLink[item.link] = item.rank;
    }
    return {
      keyword: target.keyword,
      checkedAt: new Date().toISOString(),
      topLinks,
      rankByLink,
    };
  } catch (error) {
    return {
      keyword: target.keyword,
      checkedAt: new Date().toISOString(),
      topLinks: [],
      rankByLink: {},
      error: String(error && error.message ? error.message : error),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function worker(context, queue, results, index) {
  while (queue.length) {
    const target = queue.shift();
    if (!target) break;
    console.error(`[rank:${index}] ${target.keyword}`);
    results.push(await checkKeyword(context, target));
    await sleep(250);
  }
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));
  const targets = collectTargets(payload);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 1600 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    locale: 'ko-KR',
  });

  const queue = [...targets];
  const results = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, (_, index) =>
      worker(context, queue, results, index + 1)
    )
  );
  await browser.close();

  const rankByLink = {};
  for (const result of results) {
    for (const [link, rank] of Object.entries(result.rankByLink || {})) {
      rankByLink[link] = rank;
    }
  }

  const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .replace(/[-: ]/g, '').slice(0, 14);
  const outPath = path.join(OUT_DIR, `target-blog-post-search-ranks-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    generatedAtKst: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }),
    inputJson: INPUT_JSON,
    topN: TOP_N,
    keywordCount: targets.length,
    rankedLinkCount: Object.keys(rankByLink).length,
    rankByLink,
    results: results.sort((a, b) => a.keyword.localeCompare(b.keyword, 'ko')),
  }, null, 2));
  console.log(outPath);
  console.log(JSON.stringify({
    keywordCount: targets.length,
    rankedLinkCount: Object.keys(rankByLink).length,
    outPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
