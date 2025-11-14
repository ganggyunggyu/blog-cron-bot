const { crawlWithRetry } = require('./dist/crawler');
const { extractPopularItems } = require('./dist/parser');
const cheerio = require('cheerio');
const fs = require('fs');

async function testLaminate() {
  try {
    const query = '무삭제 라미네이트 후기';
    console.log(`검색어: ${query}`);
    console.log('='.repeat(60));

    const html = await crawlWithRetry(query, 1);

    // HTML 저장
    fs.writeFileSync('test-laminate.html', html);
    console.log('✅ HTML 저장: test-laminate.html\n');

    // 1. 기존 선택자 확인
    console.log('📌 기존 선택자 확인:');
    console.log(`  - fds-ugc-block-mod: ${html.includes('fds-ugc-block-mod') ? '✅' : '❌'}`);
    console.log(`  - fds-ugc-single-intention-item-list: ${html.includes('fds-ugc-single-intention-item-list') ? '✅' : '❌'}`);

    // 2. 새 선택자 확인 (유저가 제시한 것)
    console.log('\n📌 새 선택자 확인:');
    const hasContainer = html.includes('fds-ugc-single-intention-item-list');
    const hasItem = html.includes('xYjt3uiECoJ0o6Pj0xOU');
    const hasTitleLink = html.includes('CC5p8OBUeZzCymeWTg7v');
    const hasPreview = html.includes('vhAXtgPpcvABjkgTaDZ0');

    console.log(`  - container (fds-ugc-single-intention-item-list): ${hasContainer ? '✅' : '❌'}`);
    console.log(`  - item (xYjt3uiECoJ0o6Pj0xOU): ${hasItem ? '✅' : '❌'}`);
    console.log(`  - titleLink (CC5p8OBUeZzCymeWTg7v): ${hasTitleLink ? '✅' : '❌'}`);
    console.log(`  - preview (vhAXtgPpcvABjkgTaDZ0): ${hasPreview ? '✅' : '❌'}`);

    // 3. 현재 파서 결과
    console.log('\n📊 현재 파서 결과:');
    const items = extractPopularItems(html);
    console.log(`  추출된 아이템: ${items.length}개`);

    if (items.length > 0) {
      console.log('\n추출된 아이템 목록:');
      items.forEach((item, idx) => {
        console.log(`  ${idx + 1}. [${item.group}] ${item.blogName}`);
        console.log(`     제목: ${item.title}`);
        console.log(`     링크: ${item.link}\n`);
      });
    } else {
      console.log('  ⚠️  아이템을 하나도 추출하지 못했습니다!\n');
    }

    // 4. 인기글 관련 HTML 구조 찾기
    console.log('📌 인기글 관련 구조 검색:');
    const $ = cheerio.load(html);

    // 인기글 텍스트 찾기
    const popularTexts = [];
    $('*').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes('인기글') && text.length < 50) {
        popularTexts.push({
          text,
          class: $(el).attr('class') || '',
          tag: el.tagName
        });
      }
    });

    if (popularTexts.length > 0) {
      console.log('  "인기글" 텍스트를 포함한 요소들:');
      popularTexts.slice(0, 5).forEach(({ text, class: className, tag }) => {
        console.log(`    <${tag} class="${className}">${text}</${tag}>`);
      });
    }

    // 5. 실제 블로그 링크가 있는 구조 찾기
    console.log('\n📌 blog.naver.com 링크 구조:');
    const $blogLinks = $('a[href*="blog.naver.com"]');
    console.log(`  총 ${$blogLinks.length}개 발견`);

    if ($blogLinks.length > 0) {
      console.log('\n  샘플 3개:');
      $blogLinks.slice(0, 3).each((idx, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        const text = $el.text().trim().substring(0, 50);
        const classes = $el.attr('class') || '';
        const parent = $el.parent().attr('class') || '';

        console.log(`    ${idx + 1}. text: "${text}"`);
        console.log(`       href: ${href}`);
        console.log(`       class: "${classes}"`);
        console.log(`       parent class: "${parent}"\n`);
      });
    }

  } catch (error) {
    console.error('에러:', error.message);
  }
}

testLaminate();
