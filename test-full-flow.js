const { crawlWithRetry } = require('./dist/crawler');
const { extractPopularItems } = require('./dist/parser');
const { matchBlogs, extractBlogId } = require('./dist/matcher');
const { BLOG_IDS } = require('./dist/constants');

async function testFullFlow() {
  try {
    const query = '무삭제 라미네이트 후기';
    console.log(`검색어: ${query}`);
    console.log('='.repeat(60));

    // 1. 크롤링
    console.log('\n[1단계] HTML 크롤링...');
    const html = await crawlWithRetry(query, 1);
    console.log('✅ 완료');

    // 2. 파싱
    console.log('\n[2단계] 아이템 추출...');
    const items = extractPopularItems(html);
    console.log(`✅ 총 ${items.length}개 추출`);

    if (items.length > 0) {
      console.log('\n추출된 아이템:');
      items.forEach((item, idx) => {
        const blogId = extractBlogId(item.blogLink || item.link);
        console.log(`  ${idx + 1}. [${item.group}]`);
        console.log(`     블로그: ${item.blogName} (ID: ${blogId})`);
        console.log(`     제목: ${item.title}`);
        console.log(`     링크: ${item.link}`);
      });
    }

    // 3. 매칭 (allowAnyBlog: true)
    console.log('\n[3단계] 매칭 (allowAnyBlog: true)...');
    const matchesAny = matchBlogs(query, items, { allowAnyBlog: true });
    console.log(`✅ ${matchesAny.length}개 매칭`);

    if (matchesAny.length > 0) {
      console.log('\n매칭 결과:');
      matchesAny.forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match.blogName} (${match.blogId})`);
        console.log(`     노출: ${match.exposureType} - ${match.topicName || '인기글'} ${match.position}위`);
        console.log(`     제목: ${match.postTitle}`);
      });
    }

    // 4. 매칭 (allowAnyBlog: false - 화이트리스트만)
    console.log('\n[4단계] 매칭 (allowAnyBlog: false - 화이트리스트만)...');
    console.log(`화이트리스트: ${BLOG_IDS.length}개 블로그`);
    console.log(`  샘플: ${BLOG_IDS.slice(0, 5).join(', ')}...`);

    const matchesWhitelist = matchBlogs(query, items, { allowAnyBlog: false });
    console.log(`✅ ${matchesWhitelist.length}개 매칭`);

    if (matchesWhitelist.length > 0) {
      console.log('\n화이트리스트 매칭 결과:');
      matchesWhitelist.forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match.blogName} (${match.blogId})`);
        console.log(`     노출: ${match.exposureType} - ${match.topicName || '인기글'} ${match.position}위`);
      });
    } else {
      console.log('⚠️  화이트리스트에 해당하는 블로그가 하나도 없습니다!');
      console.log('\n추출된 블로그 ID들:');
      items.forEach((item, idx) => {
        const blogId = extractBlogId(item.blogLink || item.link);
        const inWhitelist = BLOG_IDS.map(id => id.toLowerCase()).includes(blogId);
        console.log(`  ${idx + 1}. ${blogId} ${inWhitelist ? '✅ (화이트리스트에 있음)' : '❌ (화이트리스트에 없음)'}`);
      });
    }

  } catch (error) {
    console.error('에러:', error.message);
    console.error(error.stack);
  }
}

testFullFlow();
