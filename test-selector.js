const { crawlWithRetry } = require('./dist/crawler');
const { extractPopularItems } = require('./dist/parser');
const { NAVER_DESKTOP_HEADERS } = require('./dist/constants');

async function testSelector() {
  try {
    const query = '강남 맛집';
    console.log(`테스트 검색어: ${query}`);

    const html = await crawlWithRetry(query, 1);

    // HTML에서 인기글 섹션 찾기
    const intentionMatch = html.match(/class="fds-ugc-single-intention-item-list"[\s\S]{0,3000}/);

    if (intentionMatch) {
      console.log('\n=== 인기글 섹션 HTML (일부) ===');
      console.log(intentionMatch[0].substring(0, 2000));
    } else {
      console.log('\n❌ fds-ugc-single-intention-item-list 섹션을 찾을 수 없습니다');
    }

    // 아이템 찾기
    const itemMatch = html.match(/class="[^"]*xYjt3uiECoJ0o6Pj0xOU[^"]*"[\s\S]{0,800}/);
    if (itemMatch) {
      console.log('\n=== 아이템 HTML (일부) ===');
      console.log(itemMatch[0]);
    } else {
      console.log('\n❌ xYjt3uiECoJ0o6Pj0xOU 클래스를 찾을 수 없습니다');
    }

    // 타이틀 링크 찾기
    const titleMatch = html.match(/class="[^"]*CC5p8OBUeZzCymeWTg7v[^"]*"[\s\S]{0,300}/);
    if (titleMatch) {
      console.log('\n=== 타이틀 링크 HTML (일부) ===');
      console.log(titleMatch[0]);
    } else {
      console.log('\n❌ CC5p8OBUeZzCymeWTg7v 클래스를 찾을 수 없습니다');
    }

    // 파서로 추출한 결과
    const items = extractPopularItems(html);
    console.log(`\n=== 파서 결과: 총 ${items.length}개 추출됨 ===`);
    if (items.length > 0) {
      console.log('첫 번째 아이템:', items[0]);
    }

  } catch (error) {
    console.error('에러:', error.message);
  }
}

testSelector();
