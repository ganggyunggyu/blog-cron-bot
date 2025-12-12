import * as cheerio from 'cheerio';
import { DEFAULT_SELECTORS } from '../selectors';
import { fetchHtml } from '../../crawler';
import { NAVER_DESKTOP_HEADERS } from '../../constants';

export interface PopularItem {
  title: string;
  link: string;
  snippet: string;
  image: string;
  badge: string;
  group: string;
  blogLink: string;
  blogName: string;
  positionWithCafe?: number;
}

const SELECTORS = DEFAULT_SELECTORS;

const isExcludedLink = (href: string): boolean =>
  href.includes('cafe.naver.com') || href.includes('ader.naver.com');

export const extractPopularItems = (html: string): PopularItem[] => {
  const $ = cheerio.load(html);
  const items: PopularItem[] = [];
  let globalPosition = 0;

  // Single Intention (인기글) 섹션
  const $singleIntentionSections = $(SELECTORS.singleIntentionList);
  if ($singleIntentionSections.length > 0) {
    $singleIntentionSections.each((_, section) => {
      const $section = $(section);

      const headline = $section
        .parent()
        .find('.fds-header .sds-comps-header-left .sds-comps-text-ellipsis-1')
        .first()
        .text()
        .trim();

      const topicName = headline || '인기글';

      const $items = $section.find(SELECTORS.intentionItem);

      $items.each((_, item) => {
        globalPosition++;
        const $item = $(item);

        const $titleLink = $item.find(SELECTORS.intentionTitle).first();
        const title = $item.find(SELECTORS.intentionHeadline).text().trim();
        const postHref = $titleLink.attr('href')?.trim() || '';

        const $profile = $item.find(SELECTORS.intentionProfile).first();
        const blogName = $profile.text().trim();
        const blogHref = $profile.attr('href')?.trim() || '';

        const snippet = $item
          .find(SELECTORS.intentionPreview)
          .first()
          .text()
          .trim();

        const image =
          $item.find(SELECTORS.intentionImage).first().attr('src')?.trim() ||
          '';

        if (postHref && title && !isExcludedLink(postHref)) {
          items.push({
            title,
            link: postHref,
            snippet,
            image,
            badge: '',
            group: topicName,
            blogLink: blogHref,
            blogName,
            positionWithCafe: globalPosition,
          });
        }
      });
    });
  }

  // Snippet Paragraph (스블) 섹션
  const $snippetParagraphSections = $(SELECTORS.snippetParagraphList);
  if ($snippetParagraphSections.length > 0) {
    $snippetParagraphSections.each((_, section) => {
      const $section = $(section);

      const headline = $section
        .parent()
        .find('.fds-header .sds-comps-header-left .sds-comps-text-ellipsis-1')
        .first()
        .text()
        .trim();

      const topicName = headline || '스니펫';

      const $items = $section.find(SELECTORS.snippetItem);

      $items.each((_, item) => {
        globalPosition++;
        const $item = $(item);

        const $titleLink = $item.find(SELECTORS.snippetTitle).first();
        const title = $titleLink.find(SELECTORS.snippetHeadline).text().trim();
        const postHref = $titleLink.attr('href')?.trim() || '';

        const $profile = $item.find(SELECTORS.snippetProfile).first();
        const blogName = $profile.text().trim();
        const blogHref = $profile.attr('href')?.trim() || '';

        const snippet = $item
          .find(SELECTORS.snippetPreview)
          .first()
          .text()
          .trim();

        const image =
          $item.find(SELECTORS.snippetImage).first().attr('src')?.trim() || '';

        if (postHref && title && !isExcludedLink(postHref)) {
          items.push({
            title,
            link: postHref,
            snippet,
            image,
            badge: '',
            group: topicName,
            blogLink: blogHref,
            blogName,
            positionWithCafe: globalPosition,
          });
        }
      });
    });
  }

  // Snippet Image (스이) 섹션
  const $snippetImageSections = $(SELECTORS.snippetImageList);
  if ($snippetImageSections.length > 0) {
    $snippetImageSections.each((_, section) => {
      const $section = $(section);

      const headline = $section
        .parent()
        .find('.fds-header .sds-comps-header-left .sds-comps-text-ellipsis-1')
        .first()
        .text()
        .trim();

      const topicName = headline || '스니펫 이미지';

      const $items = $section.find(SELECTORS.snippetImageItem);

      $items.each((_, item) => {
        globalPosition++;
        const $item = $(item);

        const $titleLink = $item.find(SELECTORS.snippetImageTitle).first();
        const title = $titleLink
          .find(SELECTORS.snippetImageHeadline)
          .text()
          .trim();
        const postHref = $titleLink.attr('href')?.trim() || '';

        const $profile = $item.find(SELECTORS.snippetImageProfile).first();
        const blogName = $profile.text().trim();
        const blogHref = $profile.attr('href')?.trim() || '';

        const image =
          $item.find('.sds-comps-image img').first().attr('src')?.trim() || '';

        if (postHref && title && !isExcludedLink(postHref)) {
          items.push({
            title,
            link: postHref,
            snippet: '',
            image,
            badge: '',
            group: topicName,
            blogLink: blogHref,
            blogName,
            positionWithCafe: globalPosition,
          });
        }
      });
    });
  }

  const unique = new Map<string, PopularItem>();
  for (const item of items) {
    if (!unique.has(item.link)) {
      unique.set(item.link, item);
    }
  }

  return Array.from(unique.values());
};

export const fetchAndParsePopular = async (
  url: string
): Promise<PopularItem[]> => {
  const html = await fetchHtml(url, NAVER_DESKTOP_HEADERS);
  return extractPopularItems(html);
};

export const searchPopularItems = async (
  keyword: string
): Promise<PopularItem[]> => {
  const { buildNaverSearchUrl } = await import('../../crawler');
  const url = buildNaverSearchUrl(keyword);
  return fetchAndParsePopular(url);
};
