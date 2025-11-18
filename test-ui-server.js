const express = require('express');
const path = require('path');

// 빌드된 TypeScript 모듈 import
const {
  extractPostVendorName,
  fetchResolvedPostHtml,
} = require('./dist/index.js');
const { crawlWithRetry } = require('./dist/crawler.js');
const { extractPopularItems } = require('./dist/parser.js');
const { matchBlogs } = require('./dist/matcher.js');

const app = express();
const PORT = 3456;

app.use(express.json());
app.use(express.static('public'));

app.post('/api/test', async (req, res) => {
  const { searchQuery, vendorTarget } = req.body;

  if (!searchQuery) {
    return res.status(400).json({ error: '검색어를 입력해주세요.' });
  }

  try {
    const startTime = Date.now();

    // 1️⃣ 크롤링
    const crawlStart = Date.now();
    const html = await crawlWithRetry(searchQuery, 3);
    const crawlTime = Date.now() - crawlStart;

    // 2️⃣ 파싱
    const parseStart = Date.now();
    const items = extractPopularItems(html);
    const parseTime = Date.now() - parseStart;

    // 3️⃣ 블로그 ID 매칭
    const matchStart = Date.now();
    const allMatches = matchBlogs(searchQuery, items, { allowAnyBlog: true });
    const matchTime = Date.now() - matchStart;

    const steps = [
      { name: '크롤링', time: crawlTime },
      { name: '파싱', time: parseTime, count: items.length },
      { name: '매칭', time: matchTime, count: allMatches.length },
    ];

    // 4️⃣ vendorTarget 있으면 VENDOR 필터링, 없으면 TITLE 토큰 필터링
    const vendorChecks = [];
    let passedCount = 0;

    for (let i = 0; i < allMatches.length; i++) {
      const match = allMatches[i];
      let passed = false;
      let reason = '';
      let vendor = '';
      let checks = {};
      let fetchTime = 0;
      let error = '';

      try {
        if (vendorTarget) {
          // VENDOR 매칭 로직
          const fetchStart = Date.now();
          const postHtml = await fetchResolvedPostHtml(match.postLink);
          fetchTime = Date.now() - fetchStart;

          vendor = extractPostVendorName(postHtml);

          if (vendor) {
            const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
            const rnNorm = normalize(vendorTarget);
            const baseBrand = vendorTarget
              .replace(/(본점|지점)$/u, '')
              .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
              .trim();
            const baseBrandNorm = normalize(baseBrand);
            const brandRoot = normalize((vendorTarget.split(/\s+/)[0] || '').trim());
            const vNorm = normalize(vendor);

            const check1 = vNorm.includes(rnNorm);
            const check2 = baseBrandNorm.length >= 2 && vNorm.includes(baseBrandNorm);
            const check3 = brandRoot.length >= 2 && vNorm.includes(brandRoot);

            checks = { check1, check2, check3, vNorm };

            if (check1 || check2 || check3) {
              passed = true;
              reason = check1 ? 'VENDOR 완전일치' : check2 ? 'VENDOR 브랜드명' : 'VENDOR 루트';
            }
          }

          // VENDOR 실패 시 TITLE 체크
          if (!passed) {
            const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
            const titleRaw = match.postTitle || '';
            const title = titleRaw.toLowerCase();
            const titleNorm = normalize(titleRaw);
            const rn = vendorTarget.toLowerCase();
            const rnNorm = normalize(vendorTarget);
            const baseBrand = vendorTarget
              .replace(/(본점|지점)$/u, '')
              .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
              .trim();
            const baseBrandNorm = normalize(baseBrand);
            const brandRoot = normalize((vendorTarget.split(/\s+/)[0] || '').trim());

            const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
            const hasBrand =
              (baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm)) ||
              (brandRoot.length >= 2 && titleNorm.includes(brandRoot));

            checks = { ...checks, hasFull, hasBrand, titleNorm };

            if (hasFull || hasBrand) {
              passed = true;
              reason = hasFull ? 'TITLE 완전일치' : 'TITLE 브랜드명';
            }
          }
        } else {
          // vendorTarget 없는 경우: TITLE 토큰 매칭
          const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
          const tokens = searchQuery
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          const titleRaw = match.postTitle || '';
          const title = titleRaw.toLowerCase();
          const titleNorm = normalize(titleRaw);

          const allTokensMatch = tokens.every((tok) => {
            const tLower = tok.toLowerCase();
            return title.includes(tLower) || titleNorm.includes(normalize(tok));
          });

          checks = { titleNorm, tokens: tokens.join(', ') };

          if (allTokensMatch) {
            passed = true;
            reason = 'TITLE 토큰 매칭';
          }
        }
      } catch (err) {
        error = err.message;
      }

      if (passed) passedCount++;

      vendorChecks.push({
        index: i + 1,
        blogName: match.blogName,
        postTitle: match.postTitle,
        passed,
        reason,
        vendor,
        checks,
        fetchTime,
        error,
      });
    }

    // 5️⃣ 필터 조건 계산
    const filterConditions = vendorTarget
      ? {
          restaurantName: vendorTarget,
          rnNorm: vendorTarget.toLowerCase().replace(/\s+/g, ''),
          baseBrand: vendorTarget
            .replace(/(본점|지점)$/u, '')
            .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
            .trim(),
          baseBrandNorm: vendorTarget
            .replace(/(본점|지점)$/u, '')
            .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ''),
          brandRoot: (vendorTarget.split(/\s+/)[0] || '').trim().toLowerCase().replace(/\s+/g, ''),
        }
      : {
          searchQuery,
          tokens: searchQuery.split(/\s+/).filter((t) => t.trim().length > 0),
        };

    res.json({
      steps,
      summary: {
        totalMatches: allMatches.length,
        passed: passedCount,
        failed: allMatches.length - passedCount,
      },
      filterConditions,
      matches: allMatches.map((m, i) => ({
        index: i + 1,
        blogName: m.blogName,
        blogId: m.blogId,
        postTitle: m.postTitle,
        postLink: m.postLink,
        position: m.position,
        topicName: m.topicName,
        exposureType: m.exposureType,
      })),
      vendorChecks,
    });
  } catch (error) {
    console.error('테스트 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 테스트 UI 서버 실행 중!');
  console.log('='.repeat(60));
  console.log('');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('👉 브라우저에서 위 주소로 접속하세요!');
  console.log('');
  console.log('='.repeat(60));
});
