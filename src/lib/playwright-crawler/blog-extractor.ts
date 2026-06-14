import * as cheerio from 'cheerio';

export interface BlogItem {
  title: string;
  link: string;
  blogName: string;
  page: number;
  position?: number;
  postPublishedAt?: string;
}

const cleanText = (value: string): string =>
  String(value || '').replace(/\s+/g, ' ').trim();

const isProfileLikeText = (value: string): boolean => {
  const text = cleanText(value);
  return (
    !text ||
    text.includes('blog.naver.com') ||
    text.includes('›') ||
    text.includes('Keep에')
  );
};

const isSnippetLikeText = (value: string): boolean => {
  const text = cleanText(value);
  return text.length > 120 || /^\d+\s*(?:분|시간|일|주|개월|년)\s*전/u.test(text);
};

const isUsableTitle = (value: string): boolean =>
  !isProfileLikeText(value) && !isSnippetLikeText(value);

const getBestTitle = ($el: cheerio.Cheerio<any>): string => {
  const directText = cleanText($el.text() || $el.attr('title') || '');
  if (isUsableTitle(directText)) return directText;

  let $cursor = $el;
  const titleSelectors = [
    '.title_link',
    '.api_txt_lines',
    '.sds-comps-text-type-headline1',
    '.total_tit',
    '.link_tit',
  ].join(', ');

  for (let depth = 0; depth < 6; depth += 1) {
    const title = cleanText($cursor.find(titleSelectors).first().text());
    if (isUsableTitle(title)) return title;
    $cursor = $cursor.parent();
    if ($cursor.length === 0) break;
  }

  return directText;
};

const getPostPublishedAt = ($el: cheerio.Cheerio<any>): string => {
  let $cursor = $el;

  for (let depth = 0; depth < 6; depth += 1) {
    const subtext = cleanText(
      $cursor.find('.sds-comps-profile-info-subtext').first().text()
    );
    const subtextRelativeDate = subtext.match(/\d+\s*(?:분|시간|일|주|개월|년)\s*전/u);
    if (subtextRelativeDate?.[0]) return subtextRelativeDate[0].replace(/\s+/g, '');

    const text = cleanText($cursor.text());
    const relativeDate = text.match(/\d+\s*(?:분|시간|일|주|개월|년)\s*전/u);
    if (relativeDate?.[0]) return relativeDate[0].replace(/\s+/g, '');

    $cursor = $cursor.parent();
    if ($cursor.length === 0) break;
  }

  return '';
};

const isBetterTitle = (nextTitle: string, prevTitle: string): boolean => {
  if (!prevTitle) return !!nextTitle;
  if (!nextTitle) return false;
  if (!isUsableTitle(nextTitle)) return false;
  if (!isUsableTitle(prevTitle)) return true;
  return nextTitle.length > prevTitle.length;
};

export const extractAllBlogLinks = (html: string, page: number = 1): BlogItem[] => {
  const $ = cheerio.load(html);
  const itemByLink = new Map<string, BlogItem>();

  $('a[href*="blog.naver.com"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href')?.trim() || '';

    if (!href) return;
    if (href.includes('cafe.naver.com')) return;

    const postMatch = href.match(/blog\.naver\.com\/([^/?]+)\/(\d+)/);
    if (!postMatch) return;

    const title = getBestTitle($el);
    const postPublishedAt = getPostPublishedAt($el);
    const existing = itemByLink.get(href);

    if (existing) {
      if (isBetterTitle(title, existing.title)) existing.title = title;
      if (!existing.postPublishedAt && postPublishedAt) {
        existing.postPublishedAt = postPublishedAt;
      }
      return;
    }

    itemByLink.set(href, {
      title,
      link: href,
      blogName: postMatch[1],
      page,
      postPublishedAt,
    });
  });

  return Array.from(itemByLink.values());
};

export const extractBlogId = (url: string): string | null => {
  const match = url.match(/blog\.naver\.com\/([^/?]+)/);
  return match ? match[1] : null;
};
