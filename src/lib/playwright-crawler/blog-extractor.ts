import * as cheerio from 'cheerio';

export interface BlogItem {
  title: string;
  link: string;
  blogName: string;
  page: number;
}

export const extractAllBlogLinks = (html: string, page: number = 1): BlogItem[] => {
  const $ = cheerio.load(html);
  const items: BlogItem[] = [];
  const seenLinks = new Set<string>();

  $('a[href*="blog.naver.com"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href')?.trim() || '';

    if (!href || seenLinks.has(href)) return;
    if (href.includes('cafe.naver.com')) return;

    const postMatch = href.match(/blog\.naver\.com\/([^/?]+)\/(\d+)/);
    if (!postMatch) return;

    seenLinks.add(href);

    const title = $el.text().trim() || $el.attr('title')?.trim() || '';

    items.push({
      title,
      link: href,
      blogName: postMatch[1],
      page,
    });
  });

  return items;
};

export const extractBlogId = (url: string): string | null => {
  const match = url.match(/blog\.naver\.com\/([^/?]+)/);
  return match ? match[1] : null;
};
