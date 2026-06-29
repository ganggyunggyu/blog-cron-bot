import { BLOG_IDS, EXCLUDED_BLOG_IDS } from './constants';
import { PopularItem } from './parser';
import { extractBlogIdFromUrl } from './lib/naver-source';

const EXCLUDED_SET = new Set(
  EXCLUDED_BLOG_IDS.map((id) => id.toLowerCase())
);

const isGenericBlogGroup = (group: string): boolean =>
  group === '통합검색 블로그' || /^검색결과 \d+페이지$/u.test(group);

const isInfluencerGroup = (group: string): boolean =>
  group === '인플루언서 콘텐츠';

export interface ExposureResult {
  query: string;
  blogId: string;
  blogName: string;
  postTitle: string;
  postLink: string;
  postPublishedAt?: string;
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
  options?: { allowAnyBlog?: boolean; blogIds?: string[] }
): ExposureResult[] => {
  const results: ExposureResult[] = [];
  const targetBlogIds = options?.blogIds ?? BLOG_IDS;
  const allowedIds = new Set(targetBlogIds.map((id) => id.toLowerCase()));
  const allowAnyBlog = !!(options && options.allowAnyBlog);

  const itemsForLogic = items.filter((item) => !isInfluencerGroup(item.group));
  const uniqueGroups = new Set(
    (itemsForLogic.length > 0 ? itemsForLogic : items).map((item) => item.group)
  );

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
    const blogId =
      (item.sourceType === 'blog' ? item.sourceId || '' : '') ||
      extractBlogIdFromUrl(item.blogLink || item.link) ||
      extractBlogId(item.blogLink || item.link);

    const accept = allowAnyBlog
      ? !!blogId && !EXCLUDED_SET.has(blogId)
      : blogId && allowedIds.has(blogId);
    if (accept) {
      let exposureType: string;
      const isGenericBlogResult = isGenericBlogGroup(item.group || '');

      if (isGenericBlogResult) {
        exposureType = item.group;
      } else if (isInfluencerGroup(item.group || '')) {
        exposureType = '인플루언서 콘텐츠';
      } else if (item.page && item.page > 1) {
        exposureType = `검색결과 ${item.page}페이지`;
      } else {
        exposureType = isPopular ? '인기글' : '스블';
      }
      const topicName = item.group;

      const position = isPopular
        ? index + 1
        : itemPositions.get(item) || index + 1;

      const positionWithCafe =
        isPopular && !isGenericBlogResult ? item.positionWithCafe : undefined;

      results.push({
        query,
        blogId,
        blogName: item.blogName,
        postTitle: item.title,
        postLink: item.link,
        postPublishedAt: item.postPublishedAt,
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
