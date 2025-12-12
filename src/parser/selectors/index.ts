export interface PopularSelectorConfig {
  // Single Intention (인기글)
  singleIntentionList: string;
  intentionItem: string;
  intentionTitle: string;
  intentionHeadline: string;
  intentionPreview: string;
  intentionProfile: string;
  intentionImage: string;

  // Snippet Paragraph (스블)
  snippetParagraphList: string;
  snippetItem: string;
  snippetTitle: string;
  snippetHeadline: string;
  snippetPreview: string;
  snippetProfile: string;
  snippetImage: string;

  // Snippet Image (스이)
  snippetImageList: string;
  snippetImageItem: string;
  snippetImageTitle: string;
  snippetImageHeadline: string;
  snippetImageProfile: string;
}

export const DEFAULT_SELECTORS: PopularSelectorConfig = {
  // Single Intention (인기글)
  singleIntentionList:
    '.fds-ugc-single-intention-item-list, .fds-ugc-single-intention-item-list-rra',
  intentionItem: '[data-template-id="ugcItem"]',
  intentionTitle:
    'a[data-heatmap-target=".link"], a[data-heatmap-target=".imgtitlelink"]',
  intentionHeadline: '.sds-comps-text-type-headline1',
  intentionPreview: '.sds-comps-text-type-body1',
  intentionProfile: '.sds-comps-profile-info-title-text a',
  intentionImage: '.sds-comps-image img',

  // Snippet Paragraph (스블)
  snippetParagraphList: '.fds-ugc-snippet-paragraph-item-list',
  snippetItem: '[data-template-type="snippetParagraph"]',
  snippetTitle: 'a.QCvLchZmBzziK2un6REU',
  snippetHeadline: '.sds-comps-text-type-headline1',
  snippetPreview: '.sds-comps-text-type-body1',
  snippetProfile: '.sds-comps-profile-info-title-text a',
  snippetImage: '.sds-comps-image img',

  // Snippet Image (스이)
  snippetImageList: '.fds-ugc-snippet-image-item-list',
  snippetImageItem: '[data-template-type="snippetImage"]',
  snippetImageTitle: 'a.RHXjrlEdF5ThcSmmhH8g',
  snippetImageHeadline: '.sds-comps-text-type-headline1',
  snippetImageProfile: '.sds-comps-profile-info-title-text a',
} as const;

export const updateSelectors = (
  partial: Partial<PopularSelectorConfig>
): PopularSelectorConfig => ({
  ...DEFAULT_SELECTORS,
  ...partial,
});
