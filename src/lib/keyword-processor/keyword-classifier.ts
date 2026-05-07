import { normalizeSheetType } from '../../sheet-config';
import { PopularItem } from '../../parser';
import { KeywordType } from './types';

export const extractRestaurantName = (
  keywordDoc: any,
  query: string
): string => {
  return (
    String((keywordDoc as any).restaurantName || '').trim() ||
    (() => {
      const m = (query || '').match(/\(([^)]+)\)/);
      return m ? m[1].trim() : '';
    })()
  );
};

export const shouldExclude = (company: string, keyword?: string): boolean => {
  const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
  if (normalizedCompany.includes('프로그램')) return true;

  if (keyword) {
    const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, '');
    if (normalizedKeyword.includes('자료미전달') || normalizedKeyword.includes('미전달리스트')) {
      return true;
    }
  }

  return false;
};

export const getVendorTarget = (
  keywordDoc: any,
  restaurantName: string
): string => {
  const companyRaw = String((keywordDoc as any).company || '').trim();
  const sheetTypeCanon = normalizeSheetType(
    (keywordDoc as any).sheetType || ''
  );
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const companyNorm = norm(companyRaw);
  const vendorBrand = companyNorm.includes(norm('서리펫'))
    ? '서리펫'
    : sheetTypeCanon === 'dogmaru'
    ? '도그마루'
    : '';
  return restaurantName || vendorBrand;
};

export const getKeywordType = (
  keywordDoc: any,
  restaurantName: string
): KeywordType => {
  const companyRaw = String((keywordDoc as any).company || '').trim();
  const sheetTypeCanon = normalizeSheetType(
    (keywordDoc as any).sheetType || ''
  );
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const companyNorm = norm(companyRaw);

  if (restaurantName) return 'restaurant';

  if (companyNorm.includes(norm('서리펫')) || sheetTypeCanon === 'dogmaru') {
    return 'pet';
  }

  return 'basic';
};

export const getIsNewLogicFromItems = (items: PopularItem[]): boolean => {
  const firstPageItems = items.filter((item) => !item.page || item.page === 1);

  return (
    firstPageItems.length > 0 &&
    firstPageItems.every((item) => item.isNewLogic === true)
  );
};
