import type { PageCheckSheetType } from '../../database';

const dedupeBlogIds = (blogIds: readonly string[]): string[] =>
  Array.from(new Set(blogIds.map((blogId) => blogId.toLowerCase())));

const BLACK_GOAT_BLOG_IDS = [
  'biggoose488',
  'dhtksk1p',
  'regular14631',
  'selzze',
  '4giccokx',
  'ebbte',
  'uqgidh2690',
  'eytkgy5500',
  'yenalk',
  'dyust',
] as const;

const DIET_SUPPLEMENT_BLOG_IDS = ['ags2oigb'] as const;

const EYE_CLINIC_BLOG_IDS = [
  'mixxut',
  'ynattg',
  'nahhjo',
  'mzuul',
  'hagyga',
  'geenl',
  'ghhoy',
] as const;

const SKIN_PROCEDURE_BLOG_IDS = ['cookie4931'] as const;

const DENTAL_BLOG_IDS = ['wound12567'] as const;

const PRESCRIPTION_BLOG_IDS = ['precede1451'] as const;

const PAGE_PET_BLOG_IDS = [
  'loand3324',
  'fail5644',
  'compare14310',
  '8i2vlbym',
  'dyulp',
  'njmzdksm',
  'e6yb5u4k',
] as const;

const PAGE_SURI_PET_BLOG_IDS = [
  'suc4dce7',
  'xzjmfn3f',
  '8ua1womn',
  '0ehz3cb2',
  'br5rbg',
  'beautifulelephant274',
] as const;

const GENERAL_ONLY_BLOG_IDS = [
  'solantoro',
  'mygury1',
  'surreal805',
  'ybs1224',
  'minpilates',
  'busansmart',
  'dnation09',
  'dreamclock33',
  'sarangchai_',
  'i_thinkkkk',
  'sw078',
  'seowoo7603',
  'tpeany',
  'hotelelena',
  'ikc9036',
  'skidrow762',
  'sghjan',
  'sunyzone2',
  'na3997',
] as const;

const PAGE_ONLY_BLOG_IDS = dedupeBlogIds([
  ...BLACK_GOAT_BLOG_IDS,
  ...DIET_SUPPLEMENT_BLOG_IDS,
  ...EYE_CLINIC_BLOG_IDS,
  ...SKIN_PROCEDURE_BLOG_IDS,
  ...DENTAL_BLOG_IDS,
  ...PRESCRIPTION_BLOG_IDS,
  ...PAGE_PET_BLOG_IDS,
  ...PAGE_SURI_PET_BLOG_IDS,
]);

// 노출체크 대상 블로그 계정 목록(블로그 URL 기준 ID)
export const BLOG_IDS = dedupeBlogIds([
  ...PAGE_ONLY_BLOG_IDS,
  ...GENERAL_ONLY_BLOG_IDS,
]);

// cron:pages용 전체 블로그
export const PAGES_BLOG_IDS = [...PAGE_ONLY_BLOG_IDS];

// 도그마루 전용 블로그
export const DOGMARU_BLOG_IDS = dedupeBlogIds([
  ...PAGE_PET_BLOG_IDS,
  'tpeany',
]);

// 서리펫 전용 블로그
export const SURI_PET_BLOG_IDS = [...PAGE_SURI_PET_BLOG_IDS];

export const PET_PAGE_CHECK_BLOG_IDS = dedupeBlogIds([
  ...DOGMARU_BLOG_IDS,
  ...SURI_PET_BLOG_IDS,
]);

export const PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE: Record<
  PageCheckSheetType,
  string[]
> = {
  'black-goat-new': [...BLACK_GOAT_BLOG_IDS],
  'black-goat-old': [...BLOG_IDS],
  'diet-supplement': [...DIET_SUPPLEMENT_BLOG_IDS],
  'skin-procedure': [...SKIN_PROCEDURE_BLOG_IDS],
  dental: [...DENTAL_BLOG_IDS],
  prescription: [...PRESCRIPTION_BLOG_IDS],
  'eye-clinic': [...EYE_CLINIC_BLOG_IDS],
  pet: [...PET_PAGE_CHECK_BLOG_IDS],
  suripet: [...PAGE_SURI_PET_BLOG_IDS],
};
