const dedupeAlibabaBlogIds = (blogIds: readonly string[]): string[] =>
  Array.from(new Set(blogIds.map((blogId) => blogId.toLowerCase())));

export const ALIBABA_BLOG_IDS = dedupeAlibabaBlogIds([
  'weed3122',
  'mad1651',
  'chemical12568',
  'copy11525',
  'individual14144',
  'kwen1030',
  'crvfwy7062',
  'wzlphw5449',
  'heavymouse448',
  'ui3nnkai',
  'rqr1io45',
] as const);

export const ALIBABA_SECTION_NAMES = [
  '블로그 1',
  '블로그 2',
  '블로그 3',
  '블로그 4',
  '블로그 5',
] as const;

export type AlibabaSectionName = (typeof ALIBABA_SECTION_NAMES)[number];

export const ALIBABA_BLOG_IDS_BY_SECTION: Record<
  AlibabaSectionName,
  string[]
> = {
  '블로그 1': [...ALIBABA_BLOG_IDS],
  '블로그 2': [...ALIBABA_BLOG_IDS],
  '블로그 3': [...ALIBABA_BLOG_IDS],
  '블로그 4': [...ALIBABA_BLOG_IDS],
  '블로그 5': [...ALIBABA_BLOG_IDS],
};

export const ALIBABA_TAB_NAME = '알리바바';
