import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

type SelectorGuess = {
  singleIntentionList: string;
  intentionItem: string;
  intentionTitle: string;
  intentionHeadline: string;
  intentionProfile: string;
};

const analyzeSelectors = (html: string): SelectorGuess => {
  const $ = cheerio.load(html);
  
  // Look for the container element
  let singleIntentionList = '';
  const containerSelectors = ['.fds-ugc-single-intention-item-list', '.sds-comps-vertical-layout.fds-ugc-single-intention-item-list', '.sds-comps-vertical-layout[data-template-id="layout"][data-template-type="vertical"]'];
  
  for (const selector of containerSelectors) {
    const $container = $(selector);
    if ($container.length > 0) {
      singleIntentionList = selector;
      break;
    }
  }
  
  // If no container was found with predefined selectors, try to find elements with similar characteristics
  if (!singleIntentionList) {
    const elements = $('div, section').filter((i, el) => {
      const $el = $(el);
      const classes = $el.attr('class') || '';
      return classes.includes('intention') || classes.includes('popular') || classes.includes('item-list');
    });
    
    if (elements.length > 0) {
      const bestMatch = elements.first();
      singleIntentionList = bestMatch.attr('class')?.split(' ').map(cls => `.${cls}`).join('.') || '';
    }
  }

  // Look for item wrapper
  let intentionItem = '';
  const itemSelectors = ['.xYjt3uiECoJ0o6Pj0xOU', '.sds-comps-vertical-layout.KuzouLxTqWJ5UVpERiYP', '[data-template-id="ugcItem"]', '.intention-item', '.popular-item'];
  
  for (const selector of itemSelectors) {
    const $items = $(selector);
    if ($items.length > 0) {
      intentionItem = selector;
      break;
    }
  }
  
  if (!intentionItem) {
    const elements = $('div').filter((i, el) => {
      const $el = $(el);
      const classes = $el.attr('class') || '';
      return classes.includes('item') && !$el.find(intentionItem || '*').length; // Direct children
    }).slice(0, 5); // Limit to first 5 potential matches
    
    if (elements.length > 0) {
      const bestMatch = elements.first();
      intentionItem = bestMatch.attr('class')?.split(' ').map(cls => `.${cls}`).join('.') || '';
    }
  }

  // Look for title link
  let intentionTitle = '';
  const titleSelectors = ['a._228e3bd1', 'a.CC5p8OBUeZzCymeWTg7v', '[data-heatmap-target=".link"]', '.title-link', '.title a', 'a.title'];
  
  for (const selector of titleSelectors) {
    const $titles = $(selector);
    if ($titles.length > 0) {
      intentionTitle = selector;
      break;
    }
  }
  
  if (!intentionTitle) {
    const elements = $('a').filter((i, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      return (href.includes('blog.naver.com') || href.includes('cafe.naver.com')) && $el.find('span, div').length > 0;
    });
    
    if (elements.length > 0) {
      intentionTitle = 'a';
    }
  }

  // Look for headline/text (title text)
  let intentionHeadline = '';
  const headlineSelectors = ['.sds-comps-text-type-headline1', '.sds-comps-text.sds-comps-text-type-headline1', '.title_class', '.headline', '.title-text', 'span', '.sds-comps-text'];
  
  for (const selector of headlineSelectors) {
    const $headlines = $(selector);
    if ($headlines.length > 0) {
      intentionHeadline = selector;
      break;
    }
  }

  // Look for profile/blog name
  let intentionProfile = '';
  const profileSelectors = ['a._475445f0', 'a._228e3bd1', '.sds-comps-text-type-body2', '.blog-name', '.profile', '.source'];
  
  for (const selector of profileSelectors) {
    const $profiles = $(selector);
    if ($profiles.length > 0) {
      intentionProfile = selector;
      break;
    }
  }

  return {
    singleIntentionList: singleIntentionList || '.sds-comps-vertical-layout.fds-ugc-single-intention-item-list',
    intentionItem: intentionItem || '.xYjt3uiECoJ0o6Pj0xOU',
    intentionTitle: intentionTitle || 'a._228e3bd1',
    intentionHeadline: intentionHeadline || '.sds-comps-text-type-headline1',
    intentionProfile: intentionProfile || 'a._475445f0'
  };
};

// Function to update parser.ts with new selectors
const updateParserFile = (selectors: SelectorGuess) => {
  const parserFilePath = path.join(__dirname, '../parser.ts');
  const content = fs.readFileSync(parserFilePath, 'utf8');
  
  // Update the SELECTORS constant
  const updatedContent = content.replace(
    /singleIntentionList:\s*'(.*?)',/,
    `singleIntentionList: '${selectors.singleIntentionList}',`
  ).replace(
    /intentionItem:\s*'(.*?)',/,
    `intentionItem: '${selectors.intentionItem}',`
  ).replace(
    /intentionTitle:\s*'(.*?)',/,
    `intentionTitle: '${selectors.intentionTitle}',`
  ).replace(
    /intentionHeadline:\s*'(.*?)',/,
    `intentionHeadline: '${selectors.intentionHeadline}',`
  ).replace(
    /intentionProfile:\s*'(.*?)',/,
    `intentionProfile: '${selectors.intentionProfile}',`
  );

  fs.writeFileSync(parserFilePath, updatedContent);
  console.log('✅ parser.ts updated with new selectors');
};

// Main function to run the selector update process
const main = () => {
  console.log('📋 네이버 인기글 셀렉터 자동 업데이트');
  console.log('📋 HTML 구조 변경 시 셀렉터를 자동으로 업데이트 합니다.');
  console.log('');

  // Read HTML from stdin
  let html = '';
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      html += chunk;
    }
  });
  
  process.stdin.on('end', () => {
    if (!html.trim()) {
      console.log('❌ 입력된 HTML이 없습니다. 네이버 인기글 HTML을 입력해주세요.');
      return;
    }
    
    console.log('🔍 HTML 분석 중...');
    const selectors = analyzeSelectors(html);
    
    console.log('');
    console.log('✅ 분석된 셀렉터:');
    console.log('  - singleIntentionList:', selectors.singleIntentionList);
    console.log('  - intentionItem:', selectors.intentionItem);
    console.log('  - intentionTitle:', selectors.intentionTitle);
    console.log('  - intentionHeadline:', selectors.intentionHeadline);
    console.log('  - intentionProfile:', selectors.intentionProfile);
    console.log('');
    
    // Update parser.ts file
    updateParserFile(selectors);
    
    console.log('');
    console.log('🎉 네이버 인기글 셀렉터 업데이트 완료!');
    console.log('📋 이제 크롤링이 정상적으로 작동할 수 있습니다.');
  });
};

if (require.main === module) {
  main();
}

export { analyzeSelectors, updateParserFile, SelectorGuess };