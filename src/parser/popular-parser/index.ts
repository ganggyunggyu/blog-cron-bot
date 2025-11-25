import * as cheerio from 'cheerio';
import { DEFAULT_SELECTORS, PopularSelectorConfig } from '../selectors';

export interface PopularItem {
  title: string;
  link: string;
  snippet: string;
  image: string;
  badge: string;
  group: string;
  blogLink: string;
  blogName: string;
  positionWithCafe?: number; // 카페 포함 원본 순위
}

export class PopularParser {
  private $: cheerio.CheerioAPI;
  private selectors: PopularSelectorConfig;
  private items: PopularItem[] = [];
  private globalPosition: number = 0; // 카페 포함 전체 순위 추적

  constructor(html: string, selectors?: Partial<PopularSelectorConfig>) {
    this.$ = cheerio.load(html);
    this.selectors = { ...DEFAULT_SELECTORS, ...selectors };
  }

  extract(): PopularItem[] {
    this.items = [];
    this.globalPosition = 0;
    this.parseCollectionBlocks();
    this.parseSingleIntentionList();
    return this.getUniqueItems();
  }

  private parseCollectionBlocks(): void {
    const { $ } = this;
    const sel = this.selectors;

    const $collectionRoots = $(sel.collectionRoot);

    $collectionRoots.each((_, root) => {
      const $root = $(root);
      const headline = $root.find(sel.headline).first().text().trim();
      const topicName = headline || '인기글';

      const $blocks = $root.find(sel.blockMod);

      $blocks.each((_, block) => {
        const $block = $(block);
        this.globalPosition++; // 모든 항목(카페 포함) 카운트
        const item = this.parseBlockItem($block, topicName, this.globalPosition);
        if (item) this.items.push(item);
      });
    });
  }

  private parseBlockItem(
    $block: cheerio.Cheerio<any>,
    topicName: string,
    position: number
  ): PopularItem | null {
    const sel = this.selectors;

    const $blogInfo = $block.find(sel.blogInfo).first();
    const blogName = $blogInfo.text().trim();
    const blogHref =
      ($blogInfo.is('a') ? $blogInfo : $blogInfo.closest('a'))
        .attr('href')
        ?.trim() || '';

    const $postTitle = $block.find(sel.postTitle).first();
    const title = $postTitle.text().trim();

    let postHref = '';
    if ($postTitle.is('a')) {
      postHref = $postTitle.attr('href')?.trim() || '';
    } else {
      const $titleWrap = $block.find(sel.postTitleWrap).first();
      postHref = $titleWrap.attr('href')?.trim() || '';
    }

    if (!this.isValidBlogLink(postHref) || !title || !blogName) {
      return null;
    }

    return {
      title,
      link: postHref,
      snippet: '',
      image: '',
      badge: '',
      group: topicName,
      blogLink: blogHref,
      blogName,
      positionWithCafe: position, // 카페 포함 원본 순위
    };
  }

  private parseSingleIntentionList(): void {
    const { $ } = this;
    const sel = this.selectors;

    const $sections = $(sel.singleIntentionList);

    $sections.each((_, section) => {
      const $section = $(section);

      const headline = $section
        .closest('.sds-comps-vertical-layout')
        .find('.sds-comps-text-type-headline1')
        .first()
        .text()
        .trim();

      const topicName = headline || '인기글';

      const $items = $section.find(sel.intentionItem);

      $items.each((_, item) => {
        const $item = $(item);
        this.globalPosition++; // 모든 항목(카페 포함) 카운트
        const parsed = this.parseIntentionItem($item, topicName, this.globalPosition);
        if (parsed) this.items.push(parsed);
      });
    });
  }

  private parseIntentionItem(
    $item: cheerio.Cheerio<any>,
    topicName: string,
    position: number
  ): PopularItem | null {
    const sel = this.selectors;

    const $titleLink = $item.find(sel.intentionTitle).first();
    const title = $item.find(sel.intentionHeadline).text().trim();
    const postHref = $titleLink.attr('href')?.trim() || '';

    const $profile = $item.find(sel.intentionProfile).first();
    const blogName = $profile.text().trim();
    const blogHref = $profile.attr('href')?.trim() || '';

    const snippet = $item.find(sel.intentionPreview).first().text().trim();
    const image = $item.find(sel.intentionImage).first().attr('src')?.trim() || '';

    if (!postHref || !title || this.isExcludedLink(postHref)) {
      return null;
    }

    return {
      title,
      link: postHref,
      snippet,
      image,
      badge: '',
      group: topicName,
      blogLink: blogHref,
      blogName,
      positionWithCafe: position, // 카페 포함 원본 순위
    };
  }

  private isValidBlogLink(href: string): boolean {
    return (
      !!href &&
      href.includes('naver.com') &&
      !this.isExcludedLink(href)
    );
  }

  private isExcludedLink(href: string): boolean {
    return (
      href.includes('cafe.naver.com') ||
      href.includes('ader.naver.com')
    );
  }

  private getUniqueItems(): PopularItem[] {
    const unique = new Map<string, PopularItem>();
    for (const item of this.items) {
      if (!unique.has(item.link)) {
        unique.set(item.link, item);
      }
    }
    return Array.from(unique.values());
  }

  updateSelectors(partial: Partial<PopularSelectorConfig>): void {
    this.selectors = { ...this.selectors, ...partial };
  }

  getSelectors(): PopularSelectorConfig {
    return { ...this.selectors };
  }
}

export const extractPopularItems = (
  html: string,
  selectors?: Partial<PopularSelectorConfig>
): PopularItem[] => {
  const parser = new PopularParser(html, selectors);
  return parser.extract();
};
