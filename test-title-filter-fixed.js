const { extractPopularItems } = require('./dist/parser');
const { crawlWithRetry } = require('./dist/crawler');

async function testTitleFilter() {
  const query = '족저근막염깔창';
  const baseKeyword = query;

  console.log(`검색어: ${query}`);
  console.log(`baseKeyword: ${baseKeyword}\n`);

  const html = await crawlWithRetry(query, 1);
  const items = extractPopularItems(html);

  console.log(`파싱 결과: ${items.length}개\n`);

  const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
  const tokens = baseKeyword
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  console.log(`토큰: ${JSON.stringify(tokens)}\n`);
  console.log('='.repeat(60));

  items.forEach((item, idx) => {
    const titleRaw = item.title || '';  // title로 수정!
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

  const filtered = items.filter((m) => {
    const titleRaw = m.title || '';  // title로 수정!
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
  } else {
    console.log('\n통과한 아이템:');
    filtered.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.blogName} - ${item.title}`);
    });
  }
}

testTitleFilter();
