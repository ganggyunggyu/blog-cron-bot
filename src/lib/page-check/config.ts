import type { PageCheckSheetType } from '../../database';
import { getExposureMaxPages } from '../exposure-run-config';

export type PageCheckRunTarget = PageCheckSheetType | 'dogmaru';

export const PAGE_CHECK_SHEET_TYPES: PageCheckSheetType[] = [
  'pet',
  'suripet',
];

export const DOG_PET_COMPOSITE_TARGETS: readonly PageCheckRunTarget[] = [
  'dogmaru',
  'pet',
  'suripet',
];

export const PAGE_CHECK_SHEET_TYPE_NAMES: Record<PageCheckSheetType, string> = {
  pet: '애견',
  suripet: '서리펫',
};

export const PAGE_CHECK_TARGET_NAMES: Record<PageCheckRunTarget, string> = {
  ...PAGE_CHECK_SHEET_TYPE_NAMES,
  dogmaru: '도그마루',
};

const MAX_PAGES_BY_SHEET: Partial<Record<PageCheckSheetType, number>> = {
  suripet: 9,
  pet: 9,
};

const DEFAULT_MAX_PAGES = 4;

export const getMaxPagesForPageCheckSheet = (
  sheetType: PageCheckSheetType
): number =>
  getExposureMaxPages(
    MAX_PAGES_BY_SHEET[sheetType] ?? DEFAULT_MAX_PAGES
  );

export const isPageCheckSheetType = (
  target: PageCheckRunTarget
): target is PageCheckSheetType => target !== 'dogmaru';
