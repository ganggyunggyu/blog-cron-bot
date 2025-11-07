import { crawlWithRetry } from './crawler';
import { extractPopularItems } from './parser';
import { matchBlogs } from './matcher';
import { saveToCSV } from './csv-writer';
import * as fs from 'fs';
import * as path from 'path';

async function testSingleKeyword() {
  const testKeyword = '커피머신';

  console.log('🚀 테스트 시작\n');
  console.log(`🔍 테스트 키워드: "${testKeyword}"\n`);

  try {
    const html = await crawlWithRetry(testKeyword, 3);

    const debugDir = path.join(__dirname, '../debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const htmlFilePath = path.join(debugDir, `${testKeyword}_debug.html`);
    fs.writeFileSync(htmlFilePath, html, 'utf8');
    console.log(`\n📁 HTML 저장됨: ${htmlFilePath}`);

    const items = extractPopularItems(html);
    console.log(items);
    console.log(`\n✅ 인기글 ${items.length}개 추출`);

    const matches = matchBlogs(testKeyword, items);

    if (matches.length > 0) {
      console.log(`\n🎯 "${testKeyword}" 노출 발견! (${matches.length}개)\n`);
      matches.forEach((match) => {
        console.log(`  - 블로그ID: ${match.blogId}`);
        console.log(`  - 블로그명: ${match.blogName}`);
        console.log(`  - 타입: ${match.exposureType}`);
        if (match.topicName) {
          console.log(`  - 주제: ${match.topicName}`);
        }
        console.log(`  - 순위: ${match.position}위`);
        console.log(`  - 제목: ${match.postTitle}`);
        console.log(`  - URL: ${match.postLink}`);
        console.log('');
      });

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const filename = `test_${testKeyword}_${timestamp}.csv`;
      saveToCSV(matches, filename);
    } else {
      console.log(`\n❌ "${testKeyword}" 노출 없음`);
    }

    console.log('\n✅ 테스트 완료!');
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

testSingleKeyword();
