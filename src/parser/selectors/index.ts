export interface PopularSelectorConfig {
  // Collection (블록형)
  collectionRoot: string;
  headline: string;
  blockModList: string;
  blockMod: string;
  blogInfo: string;
  postTitle: string;
  postTitleWrap: string;

  // Single Intention (리스트형)
  singleIntentionList: string;
  intentionItem: string;
  intentionTitle: string;
  intentionHeadline: string;
  intentionPreview: string;
  intentionProfile: string;
  intentionImage: string;
}

export const DEFAULT_SELECTORS: PopularSelectorConfig = {
  collectionRoot: '.fds-collection-root',
  headline: '.fds-comps-header-headline',
  blockModList: '.fds-ugc-block-mod-list',
  blockMod: '.fds-ugc-block-mod',
  blogInfo: '.fds-info-inner-text',
  postTitle: '.fds-comps-right-image-text-title',
  postTitleWrap: '.fds-comps-right-image-text-title-wrap',

  singleIntentionList: '.fds-ugc-single-intention-item-list',
  intentionItem: '.oIxNPKojSTvxvkjdwXVC',
  intentionTitle: 'a.yUgjyAT8hsQKswX75JB4',
  intentionHeadline: '.sds-comps-text.sds-comps-text-type-headline1',
  intentionPreview: '.q_Caq4prL1xTKuKsMjDN .sds-comps-text-type-body1',
  intentionProfile: '.sds-comps-profile-info-title-text a',
  intentionImage: '.sds-comps-image img',
} as const;

export const updateSelectors = (
  partial: Partial<PopularSelectorConfig>
): PopularSelectorConfig => ({
  ...DEFAULT_SELECTORS,
  ...partial,
});
