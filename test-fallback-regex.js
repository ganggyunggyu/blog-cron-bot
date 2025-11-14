const { extractPopularItems } = require('./dist/parser');
const { crawlWithRetry } = require('./dist/crawler');

async function testFallbackRegex() {
  const query = '족저근막염깔창';
  const baseKeyword = query;

  const html = await crawlWithRetry(query, 1);
  const items = extractPopularItems(html);

  console.log(`검색어: ${query}\n`);

  const normalize = (s) => s.toLowerCase().replace(/\s+/g, '');
  const tokens = baseKeyword
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  console.log(`토큰 (split by space): ${JSON.stringify(tokens)}`);
  console.log(`토큰 개수: ${tokens.length}\n`);

  // 첫 번째 필터: every token includes
  const firstFilter = items.filter((m) => {
    const titleRaw = m.title || '';
    const title = titleRaw.toLowerCase();
    const titleNorm = normalize(titleRaw);
    return tokens.every((tok) => {
      const tLower = tok.toLowerCase();
      return title.includes(tLower) || titleNorm.includes(normalize(tok));
    });
  });

  console.log(`첫 번째 필터 후: ${firstFilter.length}개\n`);

  // fallback: tokens.length >= 2 인 경우만
  if (firstFilter.length === 0 && tokens.length >= 2) {
    console.log('❌ 첫 번째 필터 통과 못함 → fallback regex 시도\n');
    console.log('하지만 tokens.length = 1이라 fallback 실행 안 됨!\n');
  } else if (tokens.length === 1) {
    console.log('⚠️  토큰이 1개뿐이라 fallback regex 로직이 실행되지 않음!\n');
    console.log('해결: 검색어를 띄어쓰기로 split할 수 있어야 함\n');
    console.log('예: "족저근막염 깔창" → tokens = ["족저근막염", "깔창"]\n');
  }

  console.log('='.repeat(60));
  console.log('해결 방안:\n');
  console.log('1. 검색어를 "족저근막염 깔창"처럼 띄어쓰기로 split');
  console.log('2. 또는 음절 단위로 split (족, 저, 근, 막, 염, 깔, 창)');
  console.log('3. 또는 의미 단위로 split (족저근막염, 깔창)');
  console.log('\n현재 "족저근막염깔창"은 공백이 없어서 tokens = 1개');
  console.log('→ fallback regex가 실행되지 않음');
  console.log('→ 정확히 "족저근막염깔창" 연속 문자열이 있어야만 통과');
  console.log('='.repeat(60));
}

testFallbackRegex();
