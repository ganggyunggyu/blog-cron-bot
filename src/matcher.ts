import { BLOG_IDS } from './constants';
import { PopularItem } from './parser';

export interface ExposureResult {
  query: string;
  blogId: string;
  blogName: string;
  postTitle: string;
  postLink: string;
  exposureType: string;
  topicName: string;
  position: number;
  positionWithCafe?: number;
  isNewLogic?: boolean;
  page?: number;
  company?: string;
}

export const extractBlogId = (blogUrl: string): string => {
  if (!blogUrl) return '';

  const urlPatterns = [
    /blog\.naver\.com\/([^/?&#]+)/,
    /in\.naver\.com\/([^/?&#]+)/,
    /m\.blog\.naver\.com\/([^/?&#]+)/,
  ];

  for (const pattern of urlPatterns) {
    const match = blogUrl.match(pattern);
    if (match?.[1]) return match[1].toLowerCase();
  }

  return '';
};

export const matchBlogs = (
  query: string,
  items: PopularItem[],
  options?: { allowAnyBlog?: boolean }
): ExposureResult[] => {
  const results: ExposureResult[] = [];
  const allowedIds = new Set(BLOG_IDS.map((id) => id.toLowerCase()));
  const allowAnyBlog = !!(options && options.allowAnyBlog);

  const uniqueGroups = new Set(items.map((item) => item.group));

  const isPopular = uniqueGroups.size === 1;
  const itemPositions = new Map<PopularItem, number>();

  if (!isPopular) {
    const groupCounters = new Map<string, number>();
    items.forEach((item) => {
      const pos = (groupCounters.get(item.group) || 0) + 1;
      groupCounters.set(item.group, pos);
      itemPositions.set(item, pos);
    });
  }

  items.forEach((item, index) => {
    const blogId = extractBlogId(item.blogLink || item.link);

    const accept = allowAnyBlog ? !!blogId : blogId && allowedIds.has(blogId);
    if (accept) {
      let exposureType: string;
      if (item.page && item.page > 1) {
        exposureType = `검색결과 ${item.page}페이지`;
      } else {
        exposureType = isPopular ? '인기글' : '스블';
      }
      const topicName = item.group;

      const position = isPopular
        ? index + 1
        : itemPositions.get(item) || index + 1;

      const positionWithCafe = isPopular ? item.positionWithCafe : undefined;

      results.push({
        query,
        blogId,
        blogName: item.blogName,
        postTitle: item.title,
        postLink: item.link,
        exposureType,
        topicName,
        position,
        positionWithCafe,
        isNewLogic: item.isNewLogic ?? false,
        page: item.page,
      });
    }
  });

  return results;
};
