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
}

export const extractBlogId = (blogUrl: string): string => {
  try {
    const url = new URL(blogUrl);

    if (
      url.hostname.includes('blog.naver.com') ||
      url.hostname.includes('m.blog.naver.com')
    ) {
      const segments = url.pathname.replace(/^\//, '').split('/');
      return (segments[0] || '').toLowerCase();
    }
  } catch {}

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

  // console.log(uniqueGroups);
  const isPopular = uniqueGroups.size === 1;

  // console.log(`\n🔍 검색어: ${query}`);
  // console.log(
  //   `📊 총 ${items.length}개 아이템, 고유 group ${uniqueGroups.size}개`
  // );
  // console.log(`✅ 구분: ${isPopular ? '인기글' : '스블 (스마트블로그)'}`);

  // if (!isPopular) {
  //   console.log('📌 인기 주제들:', Array.from(uniqueGroups));
  // }

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

    const accept = allowAnyBlog ? !!blogId : (blogId && allowedIds.has(blogId));
    if (accept) {
      const exposureType = isPopular ? '인기글' : '스블';
      const topicName = isPopular ? '' : item.group;

      const position = isPopular ? index + 1 : (itemPositions.get(item) || index + 1);

      results.push({
        query,
        blogId,
        blogName: item.blogName,
        postTitle: item.title,
        postLink: item.link,
        exposureType,
        topicName,
        position,
      });
    }
  });

  return results;
};
