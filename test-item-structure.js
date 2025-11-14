const { extractPopularItems } = require('./dist/parser');
const { crawlWithRetry } = require('./dist/crawler');

async function testItemStructure() {
  const query = '족저근막염깔창';

  const html = await crawlWithRetry(query, 1);
  const items = extractPopularItems(html);

  console.log(`파싱 결과: ${items.length}개\n`);

  if (items.length > 0) {
    console.log('첫 번째 아이템 전체 구조:');
    console.log(JSON.stringify(items[0], null, 2));

    console.log('\n모든 아이템의 title 필드:');
    items.forEach((item, idx) => {
      console.log(`[${idx + 1}] title: "${item.title}"`);
      console.log(`    postTitle: "${item.postTitle}"`);
      console.log(`    blogName: "${item.blogName}"`);
    });
  }
}

testItemStructure();
