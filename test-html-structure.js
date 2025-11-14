const { crawlWithRetry } = require('./dist/crawler');
const fs = require('fs');

async function checkHtmlStructure() {
  try {
    const query = '강남 맛집';
    console.log(`테스트 검색어: ${query}`);

    const html = await crawlWithRetry(query, 1);

    // HTML 저장
    fs.writeFileSync('test-naver.html', html);
    console.log('✅ HTML 저장 완료: test-naver.html');

    // 다양한 클래스 패턴 찾기
    console.log('\n=== 클래스 패턴 검색 ===\n');

    // 1. fds-ugc 관련
    const fdsUgcPattern = /class="[^"]*fds-ugc[^"]*"/g;
    const fdsUgcMatches = html.match(fdsUgcPattern);
    if (fdsUgcMatches) {
      const uniqueClasses = [...new Set(fdsUgcMatches)];
      console.log('📌 fds-ugc 관련 클래스 (중복 제거):');
      uniqueClasses.slice(0, 20).forEach(c => console.log('  ', c));
      console.log(`  ... 총 ${uniqueClasses.length}개\n`);
    }

    // 2. intention 관련
    const intentionPattern = /class="[^"]*intention[^"]*"/gi;
    const intentionMatches = html.match(intentionPattern);
    if (intentionMatches) {
      const uniqueClasses = [...new Set(intentionMatches)];
      console.log('📌 intention 관련 클래스:');
      uniqueClasses.forEach(c => console.log('  ', c));
      console.log('');
    }

    // 3. 랜덤 해시 같은 클래스 (길이 확인)
    const hashPattern = /class="[^"]*[a-zA-Z0-9]{15,}[^"]*"/g;
    const hashMatches = html.match(hashPattern);
    if (hashMatches) {
      const uniqueClasses = [...new Set(hashMatches)];
      console.log('📌 해시 같은 긴 클래스 (샘플):');
      uniqueClasses.slice(0, 10).forEach(c => console.log('  ', c));
      console.log(`  ... 총 ${uniqueClasses.length}개\n`);
    }

    // 4. 인기글/블로그 관련 텍스트 주변 확인
    const popularIndex = html.indexOf('인기글');
    if (popularIndex > -1) {
      console.log('📌 "인기글" 텍스트 발견! 주변 HTML:');
      const snippet = html.substring(Math.max(0, popularIndex - 500), popularIndex + 1000);
      console.log(snippet);
      console.log('\n');
    }

    // 5. a 태그로 blog.naver.com 링크 찾기
    const blogLinkPattern = /<a[^>]*href="[^"]*blog\.naver\.com[^"]*"[^>]*>/g;
    const blogLinks = html.match(blogLinkPattern);
    if (blogLinks) {
      console.log('📌 blog.naver.com 링크 (샘플 3개):');
      blogLinks.slice(0, 3).forEach(link => console.log('  ', link));
      console.log(`  ... 총 ${blogLinks.length}개\n`);
    }

  } catch (error) {
    console.error('에러:', error.message);
  }
}

checkHtmlStructure();
