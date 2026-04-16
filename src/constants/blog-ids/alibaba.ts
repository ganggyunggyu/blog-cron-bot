// 알리바바 시트 내 블로그 섹션별 노출체크 대상 ID
export const ALIBABA_BLOG_IDS_BY_SECTION: Record<string, string[]> = {
  '블로그 1': ['weed3122', 'mito308141'],
  '블로그 2': ['mad1651', 'mito308141'],
  '블로그 3': ['chemical12568', 'jito308141'],
  '블로그 4': ['copy11525', 'jito308141'],
  '블로그 5': ['individual14144', 'jito308141'],
};

export const ALIBABA_SECTION_NAMES = [
  '블로그 1',
  '블로그 2',
  '블로그 3',
  '블로그 4',
  '블로그 5',
] as const;

export type AlibabaSectionName = (typeof ALIBABA_SECTION_NAMES)[number];

export const ALIBABA_TAB_NAME = '알리바바';
