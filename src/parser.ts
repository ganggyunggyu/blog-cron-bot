import * as cheerio from 'cheerio';

export interface PopularItem {
  title: string;
  link: string;
  snippet: string;
  image: string;
  badge: string;
  group: string;
  blogLink: string;
  blogName: string;
}

const SELECTORS = {
  collectionRoot: '.fds-collection-root',
  headline: '.fds-comps-header-headline',
  blockModList: '.fds-ugc-block-mod-list',
  blockMod: '.fds-ugc-block-mod',
  blogInfo: '.fds-info-inner-text',
  postTitle: '.fds-comps-right-image-text-title',
  postTitleWrap: '.fds-comps-right-image-text-title-wrap',

  singleIntentionList: '.fds-ugc-single-intention-item-list',
  intentionItem: '.NtKCZYlcjvHdeUoASy2I',
  intentionTitle: '.z1n21OFoYx6_tGcWKL_x',
  intentionHeadline: '.sds-comps-text-type-headline1.sds-comps-text-weight-sm',
  intentionProfile: '.sds-comps-profile-info-title-text a',
} as const;

export const extractPopularItems = (html: string): PopularItem[] => {
  const $ = cheerio.load(html);
  const items: PopularItem[] = [];

  console.log('\n📦 파싱 시작...\n');

  const $collectionRoots = $(SELECTORS.collectionRoot);
  console.log(`🔍 collection-root ${$collectionRoots.length}개 발견\n`);

  $collectionRoots.each((rootIdx, root) => {
    const $root = $(root);

    const headline = $root
      .find(SELECTORS.headline)
      .first()
      .text()
      .trim();

    const topicName = headline || '인기글';

    console.log(`\n📌 주제 ${rootIdx + 1}: "${topicName}"`);

    const $blocks = $root.find(SELECTORS.blockMod);
    console.log(`  → 블록 ${$blocks.length}개 발견`);

    $blocks.each((_, block) => {
      const $block = $(block);

      const $blogInfo = $block.find(SELECTORS.blogInfo).first();
      const blogName = $blogInfo.text().trim();
      const blogHref =
        ($blogInfo.is('a') ? $blogInfo : $blogInfo.closest('a'))
          .attr('href')
          ?.trim() || '';

      const $postTitle = $block.find(SELECTORS.postTitle).first();
      const title = $postTitle.text().trim();

      let postHref = '';
      if ($postTitle.is('a')) {
        postHref = $postTitle.attr('href')?.trim() || '';
      } else {
        const $titleWrap = $block.find(SELECTORS.postTitleWrap).first();
        postHref = $titleWrap.attr('href')?.trim() || '';
      }

      if (
        postHref &&
        postHref.includes('naver.com') &&
        !postHref.includes('cafe.naver.com') &&
        !postHref.includes('ader.naver.com') &&
        title &&
        blogName
      ) {
        items.push({
          title,
          link: postHref,
          snippet: '',
          image: '',
          badge: '',
          group: topicName,
          blogLink: blogHref,
          blogName,
        });
      }
    });
  });

  const $singleIntentionSections = $(SELECTORS.singleIntentionList);
  if ($singleIntentionSections.length > 0) {
    console.log(`\n🔍 single-intention-list ${$singleIntentionSections.length}개 발견\n`);

    $singleIntentionSections.each((sectionIdx, section) => {
      const $section = $(section);

      const headline = $section
        .closest('.sds-comps-vertical-layout')
        .find('.sds-comps-text-type-headline1')
        .first()
        .text()
        .trim();

      const topicName = headline || '인기글';

      console.log(`\n📌 주제 ${sectionIdx + 1}: "${topicName}"`);

      const $items = $section.find(SELECTORS.intentionItem);
      console.log(`  → 아이템 ${$items.length}개 발견`);

      $items.each((_, item) => {
        const $item = $(item);

        const $titleLink = $item.find(SELECTORS.intentionTitle).first();
        const title = $item.find(SELECTORS.intentionHeadline).text().trim();
        const postHref = $titleLink.attr('href')?.trim() || '';

        const $profile = $item.find(SELECTORS.intentionProfile).first();
        const blogName = $profile.text().trim();
        const blogHref = $profile.attr('href')?.trim() || '';

        if (
          postHref &&
          title &&
          !postHref.includes('cafe.naver.com') &&
          !postHref.includes('ader.naver.com')
        ) {
          items.push({
            title,
            link: postHref,
            snippet: '',
            image: '',
            badge: '',
            group: topicName,
            blogLink: blogHref,
            blogName,
          });
        }
      });
    });
  }

  console.log(`\n✅ 총 ${items.length}개 아이템 파싱 완료\n`);

  const unique = new Map<string, PopularItem>();
  for (const item of items) {
    if (!unique.has(item.link)) {
      unique.set(item.link, item);
    }
  }

  return Array.from(unique.values());
};
