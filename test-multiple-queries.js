const { crawlWithRetry } = require('./dist/crawler');
const { extractPopularItems } = require('./dist/parser');

async function testMultipleQueries() {
  const queries = [
    '강남 맛집',
    '제주도 여행',
    '다이어트 식단',
    '겨울 코디',
    '서울 카페'
  ];

  for (const query of queries) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`검색어: ${query}`);
      console.log('='.repeat(60));

      const html = await crawlWithRetry(query, 1);

      // 1. single-intention 구조 확인
      const hasIntention = html.includes('fds-ugc-single-intention');
      const hasxYjt = html.includes('xYjt3uiECoJ0o6Pj0xOU');
      const hasCC5p = html.includes('CC5p8OBUeZzCymeWTg7v');

      console.log('\n📌 구조 확인:');
      console.log(`  - fds-ugc-single-intention: ${hasIntention ? '✅' : '❌'}`);
      console.log(`  - xYjt3uiECoJ0o6Pj0xOU: ${hasxYjt ? '✅' : '❌'}`);
      console.log(`  - CC5p8OBUeZzCymeWTg7v: ${hasCC5p ? '✅' : '❌'}`);

      // 2. block-mod 구조 확인
      const hasBlockMod = html.includes('fds-ugc-block-mod');
      console.log(`  - fds-ugc-block-mod: ${hasBlockMod ? '✅' : '❌'}`);

      // 3. 파서 결과
      const items = extractPopularItems(html);
      console.log(`\n📊 파서 결과: ${items.length}개 추출`);

      if (items.length > 0) {
        console.log('\n첫 3개 아이템:');
        items.slice(0, 3).forEach((item, idx) => {
          console.log(`  ${idx + 1}. [${item.group}] ${item.blogName} - ${item.title.substring(0, 40)}...`);
        });
      } else {
        console.log('⚠️  아이템을 하나도 추출하지 못했습니다!');
      }

      // 딜레이
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ ${query} 에러:`, error.message);
    }
  }
}

testMultipleQueries();
