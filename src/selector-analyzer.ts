import * as cheerio from 'cheerio';

export interface SelectorInfo {
  collectionRoot?: string;
  headline?: string;
  blockMod?: string;
  postTitle?: string;
  postLink?: string;
  desc?: string;
  blogInfo?: string;
  blogName?: string;
  blogId?: string;
  singleIntentionList?: string;
  singleIntentionHeadline?: string;
  intentionItem?: string;
  intentionTitle?: string;
  intentionLink?: string;
  intentionDesc?: string;
  intentionBlogInfo?: string;
  intentionBlogName?: string;
  intentionBlogId?: string;
}

export interface AnalysisResult {
  success: boolean;
  selectors?: SelectorInfo;
  error?: string;
  detectedType?: 'collection' | 'single-intention' | 'both' | 'unknown';
}

export const analyzeNaverHtml = (html: string): AnalysisResult => {
  try {
    const $ = cheerio.load(html);
    const selectors: SelectorInfo = {};
    let detectedType: 'collection' | 'single-intention' | 'both' | 'unknown' =
      'unknown';

    const hasCollection = $('[class*="collection"]').length > 0;
    const hasSingleIntention =
      $('[class*="single-intention"]').length > 0 ||
      $('[class*="ugc-item"]').length > 0;

    if (hasCollection && hasSingleIntention) {
      detectedType = 'both';
    } else if (hasCollection) {
      detectedType = 'collection';
    } else if (hasSingleIntention) {
      detectedType = 'single-intention';
    }

    if (hasCollection) {
      const $collectionRoot = $(
        '[class*="collection"]:not([class*="item"])'
      ).first();
      if ($collectionRoot.length) {
        selectors.collectionRoot = `.${$collectionRoot
          .attr('class')
          ?.split(' ')
          .join('.')}`;

        const $headline = $collectionRoot.find('[class*="headline"]').first();
        if ($headline.length) {
          selectors.headline = `.${$headline
            .attr('class')
            ?.split(' ')
            .join('.')}`;
        }

        const $block = $collectionRoot.find('[class*="block"]').first();
        if ($block.length) {
          selectors.blockMod = `.${$block.attr('class')?.split(' ').join('.')}`;

          const $titleLink = $block.find('a[href*="blog"]').first();
          if ($titleLink.length) {
            const titleSelector = getFullSelector($titleLink);
            selectors.postTitle = titleSelector;
            selectors.postLink = titleSelector;
          }

          const $desc = $block.find('[class*="body"], [class*="desc"]').first();
          if ($desc.length) {
            selectors.desc = `.${$desc.attr('class')?.split(' ').join('.')}`;
          }

          const $blogInfo = $block.find('[class*="sub"]').first();
          if ($blogInfo.length) {
            selectors.blogInfo = `.${$blogInfo
              .attr('class')
              ?.split(' ')
              .join('.')}`;

            const $blogName = $blogInfo.find('[class*="name"]').first();
            if ($blogName.length) {
              selectors.blogName = `.${$blogName
                .attr('class')
                ?.split(' ')
                .join('.')}`;
            }

            const $blogId = $blogInfo
              .find('[class*="txt"], [class*="id"]')
              .first();
            if ($blogId.length) {
              selectors.blogId = `.${$blogId
                .attr('class')
                ?.split(' ')
                .join('.')}`;
            }
          }
        }
      }
    }

    if (hasSingleIntention) {
      const $intentionList = $(
        '[class*="single-intention"], [class*="ugc-item-list"]'
      ).first();
      if ($intentionList.length) {
        selectors.singleIntentionList = `.${$intentionList
          .attr('class')
          ?.split(' ')
          .join('.')}`;

        const $intentionHeadline = $intentionList
          .find('[class*="headline"]')
          .first();
        if ($intentionHeadline.length) {
          selectors.singleIntentionHeadline = `.${$intentionHeadline
            .attr('class')
            ?.split(' ')
            .join('.')}`;
        }

        const $intentionItem = $intentionList
          .find('[class*="ugc-item"], [class*="item"]')
          .first();
        if ($intentionItem.length) {
          selectors.intentionItem = `.${$intentionItem
            .attr('class')
            ?.split(' ')
            .join('.')}`;

          const $intentionTitleLink = $intentionItem
            .find('a[href*="blog"]')
            .first();
          if ($intentionTitleLink.length) {
            const titleSelector = getFullSelector($intentionTitleLink);
            selectors.intentionTitle = titleSelector;
            selectors.intentionLink = titleSelector;
          }

          const $intentionDesc = $intentionItem
            .find('[class*="sub-text"], [class*="desc"]')
            .first();
          if ($intentionDesc.length) {
            selectors.intentionDesc = `.${$intentionDesc
              .attr('class')
              ?.split(' ')
              .join('.')}`;
          }

          const $intentionBlogInfo = $intentionItem
            .find('[class*="info-item"]')
            .first();
          if ($intentionBlogInfo.length) {
            selectors.intentionBlogInfo = `.${$intentionBlogInfo
              .attr('class')
              ?.split(' ')
              .join('.')}`;
          }

          const $intentionBlogName = $intentionItem
            .find('[class*="info-name"], [class*="name"]')
            .first();
          if ($intentionBlogName.length) {
            selectors.intentionBlogName = `.${$intentionBlogName
              .attr('class')
              ?.split(' ')
              .join('.')}`;
          }

          const $intentionBlogId = $intentionItem
            .find('[class*="info-id"], [class*="id"]')
            .first();
          if ($intentionBlogId.length) {
            selectors.intentionBlogId = `.${$intentionBlogId
              .attr('class')
              ?.split(' ')
              .join('.')}`;
          }
        }
      }
    }

    return {
      success: true,
      selectors,
      detectedType,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const getFullSelector = ($element: ReturnType<cheerio.CheerioAPI>): string => {
  const elementTag = $element.prop('tagName')?.toLowerCase() || 'div';
  const elementClasses = $element.attr('class')?.split(' ').join('.') || '';
  const parentClasses = $element.parent().attr('class')?.split(' ').join('.');

  if (parentClasses) {
    return `.${parentClasses} > ${elementTag}${elementClasses ? '.' + elementClasses : ''}`;
  }

  return elementClasses ? `.${elementClasses}` : elementTag;
};

export const formatSelectorsForCode = (selectors: SelectorInfo): string => {
  return `const SELECTORS = {
  collectionRoot: '${selectors.collectionRoot || ''}',
  headline: '${selectors.headline || ''}',
  blockMod: '${selectors.blockMod || ''}',
  postTitle: '${selectors.postTitle || ''}',
  postLink: '${selectors.postLink || ''}',
  desc: '${selectors.desc || ''}',
  blogInfo: '${selectors.blogInfo || ''}',
  blogName: '${selectors.blogName || ''}',
  blogId: '${selectors.blogId || ''}',
  singleIntentionList: '${selectors.singleIntentionList || ''}',
  singleIntentionHeadline: '${selectors.singleIntentionHeadline || ''}',
  intentionItem: '${selectors.intentionItem || ''}',
  intentionTitle: '${selectors.intentionTitle || ''}',
  intentionLink: '${selectors.intentionLink || ''}',
  intentionDesc: '${selectors.intentionDesc || ''}',
  intentionBlogInfo: '${selectors.intentionBlogInfo || ''}',
  intentionBlogName: '${selectors.intentionBlogName || ''}',
  intentionBlogId: '${selectors.intentionBlogId || ''}',
};`;
};
