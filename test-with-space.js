const { extractPopularItems } = require('./dist/parser');
const { crawlWithRetry } = require('./dist/crawler');

async function testWithSpace() {
  const query = '족저근막염깔창';
  const baseKeywordWithSpace = '족저근막염 깔창';  // 띄어쓰기 추가!

  console.log(`실제 검색어: ${query}`);
  console.log(`baseKeyword (띄어쓰기 추가): ${baseKeywordWithSpace}\n`);

  const html = await crawlWithRetry(query, 1);
  const items = extractPopularItems(html);

  console.log(`파싱 결과: ${items.length}개\n`);

  const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
  const tokens = baseKeywordWithSpace
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  console.log(`토큰: ${JSON.stringify(tokens)}`);
  console.log(`토큰 개수: ${tokens.length}\n`);
  console.log('='.repeat(60));

  // 필터링 테스트
  items.forEach((item, idx) => {
    const titleRaw = item.title || '';
    const title = titleRaw.toLowerCase();
    const titleNorm = normalize(titleRaw);

    const results = tokens.map((tok) => {
      const tLower = tok.toLowerCase();
      const includes = title.includes(tLower);
      const includesNorm = titleNorm.includes(normalize(tok));
      return { tok, includes, includesNorm, pass: includes || includesNorm };
    });

    const allPass = results.every((r) => r.pass);

    console.log(`\n[${idx + 1}] ${item.blogName}`);
    console.log(`제목: "${titleRaw}"`);
    results.forEach(r => {
      console.log(`  "${r.tok}": ${r.pass ? '✅' : '❌'}`);
    });
    console.log(`→ ${allPass ? '✅ 통과' : '❌ 필터링'}`);
  });

  console.log('\n' + '='.repeat(60));

  const filtered = items.filter((m) => {
    const titleRaw = m.title || '';
    const title = titleRaw.toLowerCase();
    const titleNorm = normalize(titleRaw);
    return tokens.every((tok) => {
      const tLower = tok.toLowerCase();
      return title.includes(tLower) || titleNorm.includes(normalize(tok));
    });
  });

  console.log(`\n필터링 전: ${items.length}개`);
  console.log(`필터링 후: ${filtered.length}개`);
  console.log(`\n차이: ${items.length - filtered.length}개 탈락\n`);

  if (filtered.length > 0) {
    console.log('✅ 통과한 아이템:');
    filtered.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.blogName} - "${item.title}"`);
    });

    // mw_mj 있는지 확인
    const hasMwMj = filtered.some(item => item.blogLink.includes('mw_mj'));
    console.log(`\n${hasMwMj ? '✅' : '❌'} mw_mj 포함 여부: ${hasMwMj ? '포함됨!' : '없음'}`);
  }
}

testWithSpace();
