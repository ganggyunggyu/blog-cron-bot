require('dotenv').config();
const { crawlWithRetry } = require('./dist/crawler');
const { extractPopularItems } = require('./dist/parser');
const { matchBlogs } = require('./dist/matcher');
const { getSheetOptions } = require('./dist/sheet-config');

async function testExposureCheck() {
  try {
    const query = '무삭제 라미네이트 후기';
    const sheetType = 'dogmaru'; // 또는 'package'

    console.log(`\n${'='.repeat(60)}`);
    console.log(`검색어: ${query}`);
    console.log(`시트 타입: ${sheetType}`);
    console.log('='.repeat(60));

    // 1. 크롤링
    console.log('\n[1단계] 크롤링...');
    const html = await crawlWithRetry(query, 3);
    console.log('✅ HTML 크롤링 완료');

    // 2. 파싱
    console.log('\n[2단계] 아이템 파싱...');
    const items = extractPopularItems(html);
    console.log(`✅ 총 ${items.length}개 아이템 추출`);

    if (items.length > 0) {
      console.log('\n추출된 아이템:');
      items.forEach((item, idx) => {
        console.log(`\n  ${idx + 1}. [${item.group}]`);
        console.log(`     블로그: ${item.blogName}`);
        console.log(`     제목: ${item.title}`);
        console.log(`     링크: ${item.link}`);
      });
    }

    // 3. 옵션 가져오기
    const options = getSheetOptions(sheetType);
    console.log(`\n[3단계] 시트 옵션:`);
    console.log(`  allowAnyBlog: ${options.allowAnyBlog}`);
    console.log(`  maxContentChecks: ${options.maxContentChecks}`);

    // 4. 매칭
    console.log('\n[4단계] 블로그 매칭...');
    const matches = matchBlogs(query, items, { allowAnyBlog: options.allowAnyBlog });
    console.log(`✅ ${matches.length}개 매칭`);

    if (matches.length > 0) {
      console.log('\n매칭 결과:');
      matches.forEach((match, idx) => {
        console.log(`\n  ${idx + 1}. ${match.blogName} (${match.blogId})`);
        console.log(`     노출: ${match.exposureType} ${match.position}위`);
        console.log(`     주제: ${match.topicName || '-'}`);
        console.log(`     제목: ${match.postTitle}`);
      });
    } else {
      console.log('\n⚠️  매칭된 결과가 없습니다!');
      console.log('   - allowAnyBlog이 false이고 화이트리스트에 없거나');
      console.log('   - 추출된 아이템이 없을 수 있습니다.');
    }

    // 5. 결론
    console.log(`\n${'='.repeat(60)}`);
    console.log('결과 요약:');
    console.log(`  크롤링: ✅`);
    console.log(`  아이템 추출: ${items.length}개`);
    console.log(`  매칭: ${matches.length}개`);

    if (items.length > 0 && matches.length === 0) {
      console.log('\n⚠️  아이템은 추출되었지만 매칭은 안 됨!');
      console.log('   원인: allowAnyBlog=false + 화이트리스트에 없음');
    } else if (items.length === 0) {
      console.log('\n❌ 아이템 추출 실패!');
      console.log('   원인: 선택자가 잘못되었거나 HTML 구조 변경');
    } else {
      console.log('\n✅ 정상 작동!');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 에러 발생:', error.message);
    console.error(error.stack);
  }
}

testExposureCheck();
