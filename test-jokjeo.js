require('dotenv').config();
const { crawlWithRetry } = require('./dist/crawler');
const { extractPopularItems } = require('./dist/parser');
const { matchBlogs } = require('./dist/matcher');
const { getSheetOptions } = require('./dist/sheet-config');

async function testJokjeo() {
  try {
    const query = '족저근막염깔창';
    const sheetType = 'dogmaru';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`검색어: ${query}`);
    console.log('='.repeat(60));

    // 1. 크롤링
    console.log('\n[1단계] 크롤링...');
    const html = await crawlWithRetry(query, 3);
    console.log('✅ HTML 크롤링 완료');

    // HTML 구조 확인
    console.log('\n[구조 확인]');
    const hasBlockMod = html.includes('fds-ugc-block-mod');
    const hasSingleIntention = html.includes('fds-ugc-single-intention-item-list');
    console.log(`  - fds-ugc-block-mod: ${hasBlockMod ? '✅' : '❌'}`);
    console.log(`  - fds-ugc-single-intention-item-list: ${hasSingleIntention ? '✅' : '❌'}`);

    // 2. 파싱
    console.log('\n[2단계] 아이템 파싱...');
    const items = extractPopularItems(html);
    console.log(`✅ 총 ${items.length}개 아이템 추출`);

    if (items.length > 0) {
      console.log('\n추출된 아이템 (모두):');
      items.forEach((item, idx) => {
        console.log(`\n  ${idx + 1}. [${item.group}]`);
        console.log(`     블로그: ${item.blogName}`);
        console.log(`     제목: ${item.title.substring(0, 60)}...`);
        console.log(`     링크: ${item.link}`);
        console.log(`     블로그링크: ${item.blogLink}`);
      });
    } else {
      console.log('\n❌ 아이템을 하나도 추출하지 못했습니다!');
    }

    // 3. 옵션 가져오기
    const options = getSheetOptions(sheetType);
    console.log(`\n[3단계] 시트 옵션:`);
    console.log(`  allowAnyBlog: ${options.allowAnyBlog}`);

    // 4. 매칭 (allowAnyBlog: true)
    console.log('\n[4단계-A] 블로그 매칭 (allowAnyBlog: true)...');
    const matchesAny = matchBlogs(query, items, { allowAnyBlog: true });
    console.log(`✅ ${matchesAny.length}개 매칭`);

    if (matchesAny.length > 0) {
      console.log('\n매칭 결과 (전체):');
      matchesAny.forEach((match, idx) => {
        console.log(`\n  ${idx + 1}. ${match.blogName} (${match.blogId})`);
        console.log(`     노출: ${match.exposureType} ${match.position}위`);
        console.log(`     주제: ${match.topicName || '-'}`);
        console.log(`     제목: ${match.postTitle.substring(0, 60)}...`);
      });
    }

    // 5. 매칭 (화이트리스트)
    console.log('\n[4단계-B] 블로그 매칭 (화이트리스트)...');
    const matches = matchBlogs(query, items, { allowAnyBlog: options.allowAnyBlog });
    console.log(`✅ ${matches.length}개 매칭`);

    if (matches.length > 0) {
      console.log('\n화이트리스트 매칭 결과:');
      matches.forEach((match, idx) => {
        console.log(`\n  ${idx + 1}. ${match.blogName} (${match.blogId})`);
        console.log(`     노출: ${match.exposureType} ${match.position}위`);
        console.log(`     주제: ${match.topicName || '-'}`);
        console.log(`     제목: ${match.postTitle.substring(0, 60)}...`);
      });
    } else {
      console.log('\n⚠️  화이트리스트에 해당하는 블로그가 없습니다!');
    }

    // 6. 결론
    console.log(`\n${'='.repeat(60)}`);
    console.log('결과 요약:');
    console.log(`  HTML 구조: ${hasBlockMod ? 'block-mod' : hasSingleIntention ? 'single-intention' : '알 수 없음'}`);
    console.log(`  아이템 추출: ${items.length}개`);
    console.log(`  매칭 (전체): ${matchesAny.length}개`);
    console.log(`  매칭 (화이트리스트): ${matches.length}개`);

    if (items.length > 0 && matchesAny.length > 0) {
      console.log('\n✅ 파서 정상 작동!');
    } else if (items.length === 0) {
      console.log('\n❌ 파서 문제 있음 - 아이템 추출 실패!');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 에러 발생:', error.message);
    console.error(error.stack);
  }
}

testJokjeo();
