import { PopularItem } from '../../parser';
import { extractBlogIdFromUrl } from '../naver-source';
import { extractAllBlogLinks } from '../playwright-crawler/blog-extractor';

export const GENERIC_BLOG_GROUP = '통합검색 블로그';

export const isGenericBlogGroup = (group: string): boolean =>
  group === GENERIC_BLOG_GROUP || /^검색결과 \d+페이지$/u.test(group);

export const appendGenericBlogItems = (
  items: PopularItem[],
  html: string,
  page: number
): PopularItem[] => {
  const seenLinks = new Set(items.map((item) => item.link));
  const group = page > 1 ? `검색결과 ${page}페이지` : GENERIC_BLOG_GROUP;
  let groupPosition = items.filter((item) => item.group === group).length;

  for (const blogItem of extractAllBlogLinks(html, page)) {
    if (seenLinks.has(blogItem.link)) continue;

    seenLinks.add(blogItem.link);
    groupPosition += 1;

    const blogId = extractBlogIdFromUrl(blogItem.link);

    items.push({
      title: blogItem.title || blogItem.link,
      link: blogItem.link,
      snippet: '',
      image: '',
      badge: '',
      group,
      blogLink: blogItem.link,
      blogName: blogItem.blogName || blogId,
      postPublishedAt: blogItem.postPublishedAt,
      positionWithCafe: groupPosition,
      isNewLogic: false,
      page,
      sourceType: 'blog',
      sourceId: blogId,
    });
  }

  return items;
};
