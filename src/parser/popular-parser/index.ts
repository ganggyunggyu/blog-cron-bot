import * as cheerio from 'cheerio';
import { DEFAULT_SELECTORS } from '../selectors';
import { fetchHtml } from '../../crawler';
import {
  detectNaverSource,
  NaverSourceType,
  resolveNaverSearchResultUrl,
} from '../../lib/naver-source';

export interface PopularItem {
  title: string;
  link: string;
  snippet: string;
  image: string;
  badge: string;
  group: string;
  blogLink: string;
  blogName: string;
  postPublishedAt?: string;
  positionWithCafe?: number;
  isNewLogic?: boolean;
  page?: number;
  sourceType?: NaverSourceType;
  sourceId?: string;
}

export interface ExtractPopularItemsOptions {
  includeCafe?: boolean;
}

const SELECTORS = DEFAULT_SELECTORS;

const isAdLink = (href: string): boolean => href.includes('ader.naver.com');

const getResolvedElementLink = ($element: cheerio.Cheerio<any>): string =>
  resolveNaverSearchResultUrl(
    $element.attr('href')?.trim() || '',
    $element.attr('cru')?.trim() || undefined
  );

const getPostPublishedAt = ($item: cheerio.Cheerio<any>): string =>
  $item.find(SELECTORS.profileSubtext).first().text().trim();

const getInfluencerIdFromUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url, 'https://in.naver.com');
    if (!parsedUrl.hostname.includes('in.naver.com')) return '';

    const pathSegments = parsedUrl.pathname.replace(/^\/+/, '').split('/');
    if (!pathSegments.includes('contents')) return '';

    return (pathSegments[0] || '').toLowerCase();
  } catch {
    return '';
  }
};

const extractInfluencerContentItems = (
  $: cheerio.CheerioAPI
): PopularItem[] => {
  const items: PopularItem[] = [];
  const seenLinks = new Set<string>();

  $('a[href*="in.naver.com/"][href*="/contents/"], button[data-url*="in.naver.com/"][data-url*="/contents/"]').each(
    (_, element) => {
      const $element = $(element);
      const rawUrl =
        $element.attr('href')?.trim() ||
        $element.attr('data-url')?.trim() ||
        '';
      const link = resolveNaverSearchResultUrl(rawUrl);
      const influencerId = getInfluencerIdFromUrl(link);

      if (!link || !influencerId || seenLinks.has(link)) {
        return;
      }

      const $item = $element.closest('[data-template-id="ugcItem"], [data-template-type="searchBasic"], .fds-ink-keyword-item, li, div');
      const title =
        $element
          .find('.sds-comps-text-type-headline1, .fds-comps-text, .sds-comps-text')
          .first()
          .text()
          .trim() ||
        $element.text().trim();
      const blogName =
        $item
          .find('.sds-comps-profile-info-title-text')
          .first()
          .text()
          .trim() || influencerId;
      const postPublishedAt = getPostPublishedAt($item);

      if (!title) {
        return;
      }

      seenLinks.add(link);
      items.push({
        title,
        link,
        snippet: '',
        image: '',
        badge: '',
        group: '인플루언서 콘텐츠',
        blogLink: `https://in.naver.com/${influencerId}`,
        blogName,
        postPublishedAt,
        sourceType: 'blog',
        sourceId: influencerId,
      });
    }
  );

  return items;
};

export const extractPopularItems = (
  html: string,
  options: ExtractPopularItemsOptions = {}
): PopularItem[] => {
  const $ = cheerio.load(html);
  const items: PopularItem[] = [];
  let globalPosition = 0;

  const $singleIntentionSections = $(SELECTORS.singleIntentionList);
  if ($singleIntentionSections.length > 0) {
    $singleIntentionSections.each((_, section) => {
      const $section = $(section);

      const headline =
        $section
          .parent()
          .find('.sds-comps-header-title h2')
          .first()
          .text()
          .trim() ||
        $section
          .parent()
          .find('.fds-header .sds-comps-header-left .sds-comps-text-ellipsis-1')
          .first()
          .text()
          .trim();

      const topicName = headline || '인기글';
      const isNewItem = !headline;

      const $items = $section.find(SELECTORS.intentionItem);

      $items.each((_, item) => {
        globalPosition++;
        const $item = $(item);

        const $titleLink = $item.find(SELECTORS.intentionTitle).first();
        const title = $item.find(SELECTORS.intentionHeadline).text().trim();
        const postHref = getResolvedElementLink($titleLink);

        const $profile = $item.find(SELECTORS.intentionProfile).first();
        const blogName = $profile.text().trim();
        const blogHref = getResolvedElementLink($profile) || postHref;
        const source = detectNaverSource(blogHref || postHref);
        const postPublishedAt = getPostPublishedAt($item);

        const snippet = $item
          .find(SELECTORS.intentionPreview)
          .first()
          .text()
          .trim();

        const image =
          $item.find(SELECTORS.intentionImage).first().attr('src')?.trim() ||
          '';

        if (
          postHref &&
          title &&
          !isAdLink(postHref) &&
          (options.includeCafe || source.type !== 'cafe')
        ) {
          items.push({
            title,
            link: postHref,
            snippet,
            image,
            badge: '',
            group: topicName,
            blogLink: blogHref,
            blogName,
            postPublishedAt,
            positionWithCafe: globalPosition,
            isNewLogic: isNewItem,
            sourceType: source.type,
            sourceId: source.id,
          });
        }
      });
    });
  }

  const $snippetParagraphSections = $(SELECTORS.snippetParagraphList);
  if ($snippetParagraphSections.length > 0) {
    $snippetParagraphSections.each((_, section) => {
      const $section = $(section);

      const headline =
        $section
          .parent()
          .find('.sds-comps-header-title h2')
          .first()
          .text()
          .trim() ||
        $section
          .parent()
          .find('.fds-header .sds-comps-header-left .sds-comps-text-ellipsis-1')
          .first()
          .text()
          .trim();

      const topicName = headline || '스니펫';
      const isNewItem = !headline;

      const $items = $section.find(SELECTORS.snippetItem);

      $items.each((_, item) => {
        globalPosition++;
        const $item = $(item);

        const $titleLink = $item.find(SELECTORS.snippetTitle).first();
        const title = $titleLink.find(SELECTORS.snippetHeadline).text().trim();
        const postHref = getResolvedElementLink($titleLink);

        const $profile = $item.find(SELECTORS.snippetProfile).first();
        const blogName = $profile.text().trim();
        const blogHref = getResolvedElementLink($profile) || postHref;
        const source = detectNaverSource(blogHref || postHref);
        const postPublishedAt = getPostPublishedAt($item);

        const snippet = $item
          .find(SELECTORS.snippetPreview)
          .first()
          .text()
          .trim();

        const image =
          $item.find(SELECTORS.snippetImage).first().attr('src')?.trim() || '';

        if (
          postHref &&
          title &&
          !isAdLink(postHref) &&
          (options.includeCafe || source.type !== 'cafe')
        ) {
          items.push({
            title,
            link: postHref,
            snippet,
            image,
            badge: '',
            group: topicName,
            blogLink: blogHref,
            blogName,
            postPublishedAt,
            positionWithCafe: globalPosition,
            isNewLogic: isNewItem,
            sourceType: source.type,
            sourceId: source.id,
          });
        }
      });
    });
  }

  const $snippetImageSections = $(SELECTORS.snippetImageList);
  if ($snippetImageSections.length > 0) {
    $snippetImageSections.each((_, section) => {
      const $section = $(section);

      const headline =
        $section
          .parent()
          .find('.sds-comps-header-title h2')
          .first()
          .text()
          .trim() ||
        $section
          .parent()
          .find('.fds-header .sds-comps-header-left .sds-comps-text-ellipsis-1')
          .first()
          .text()
          .trim();

      const topicName = headline || '스니펫 이미지';
      const isNewItem = !headline;

      const $items = $section.find(SELECTORS.snippetImageItem);

      $items.each((_, item) => {
        globalPosition++;
        const $item = $(item);

        const $titleLink = $item.find(SELECTORS.snippetImageTitle).first();
        const title = $titleLink
          .find(SELECTORS.snippetImageHeadline)
          .text()
          .trim();
        const postHref = getResolvedElementLink($titleLink);

        const $profile = $item.find(SELECTORS.snippetImageProfile).first();
        const blogName = $profile.text().trim();
        const blogHref = getResolvedElementLink($profile) || postHref;
        const source = detectNaverSource(blogHref || postHref);
        const postPublishedAt = getPostPublishedAt($item);

        const image =
          $item.find('.sds-comps-image img').first().attr('src')?.trim() || '';

        if (
          postHref &&
          title &&
          !isAdLink(postHref) &&
          (options.includeCafe || source.type !== 'cafe')
        ) {
          items.push({
            title,
            link: postHref,
            snippet: '',
            image,
            badge: '',
            group: topicName,
            blogLink: blogHref,
            blogName,
            postPublishedAt,
            positionWithCafe: globalPosition,
            isNewLogic: isNewItem,
            sourceType: source.type,
            sourceId: source.id,
          });
        }
      });
    });
  }

  const unique = new Map<string, PopularItem>();
  for (const item of [...items, ...extractInfluencerContentItems($)]) {
    if (!unique.has(item.link)) {
      unique.set(item.link, item);
    }
  }

  return Array.from(unique.values());
};

export const fetchAndParsePopular = async (
  url: string
): Promise<PopularItem[]> => {
  const html = await fetchHtml(url);
  return extractPopularItems(html);
};

export const searchPopularItems = async (
  keyword: string
): Promise<PopularItem[]> => {
  const { buildNaverSearchUrl } = await import('../../crawler');
  const url = buildNaverSearchUrl(keyword);
  return fetchAndParsePopular(url);
};
