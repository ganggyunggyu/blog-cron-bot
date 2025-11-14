const { extractPopularItems } = require('./dist/parser');
const { crawlWithRetry } = require('./dist/crawler');

async function testTitleFilter() {
  const query = '족저근막염깔창';
  const baseKeyword = query; // restaurantName이 없다고 가정

  console.log(`검색어: ${query}`);
  console.log(`baseKeyword: ${baseKeyword}\n`);

  // 크롤링 & 파싱
  const html = await crawlWithRetry(query, 1);
  const items = extractPopularItems(html);

  console.log(`파싱 결과: ${items.length}개\n`);

  // 토큰 분리
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
  const tokens = baseKeyword
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  console.log(`토큰: ${JSON.stringify(tokens)}\n`);
  console.log('='.repeat(60));

  // 각 아이템 필터링 테스트
  items.forEach((item, idx) => {
    const titleRaw = item.postTitle || '';
    const title = titleRaw.toLowerCase();
    const titleNorm = normalize(titleRaw);

    console.log(`\n[${idx + 1}] ${item.blogName}`);
    console.log(`제목: "${titleRaw}"`);
    console.log(`normalize: "${titleNorm}"`);

    const results = tokens.map((tok) => {
      const tLower = tok.toLowerCase();
      const includes = title.includes(tLower);
      const includesNorm = titleNorm.includes(normalize(tok));
      return { tok, includes, includesNorm, pass: includes || includesNorm };
    });

    const allPass = results.every((r) => r.pass);

    console.log(`필터링 결과:`);
    results.forEach(r => {
      console.log(`  - "${r.tok}": includes=${r.includes}, includesNorm=${r.includesNorm} → ${r.pass ? '✅' : '❌'}`);
    });
    console.log(`최종: ${allPass ? '✅ 통과' : '❌ 필터링됨'}`);
  });

  console.log('\n' + '='.repeat(60));

  // 필터링 후 남은 개수
  const filtered = items.filter((m) => {
    const titleRaw = m.postTitle || '';
    const title = titleRaw.toLowerCase();
    const titleNorm = normalize(titleRaw);
    return tokens.every((tok) => {
      const tLower = tok.toLowerCase();
      return title.includes(tLower) || titleNorm.includes(normalize(tok));
    });
  });

  console.log(`\n필터링 후 남은 아이템: ${filtered.length}개`);

  if (filtered.length === 0) {
    console.log('\n⚠️  모든 아이템이 필터링됨 → ❌로 표시됨!');
  }
}

testTitleFilter();
