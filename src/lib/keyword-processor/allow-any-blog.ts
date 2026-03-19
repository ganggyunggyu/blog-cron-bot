import { getSheetOptions } from '../../sheet-config';

export const getAllowAnyBlog = (
  sheetType?: string,
  allowAnyBlogOverride?: boolean
): boolean => {
  if (typeof allowAnyBlogOverride === 'boolean') {
    return allowAnyBlogOverride;
  }

  const sheetOpts = getSheetOptions(sheetType || '');
  const allowAnyEnv = String(process.env.ALLOW_ANY_BLOG || '').toLowerCase();

  if (allowAnyEnv === 'true' || allowAnyEnv === '1') return true;
  if (allowAnyEnv === 'false' || allowAnyEnv === '0') return false;
  return !!sheetOpts.allowAnyBlog;
};
