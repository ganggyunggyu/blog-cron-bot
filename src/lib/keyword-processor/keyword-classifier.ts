import { normalizeSheetType } from '../../sheet-config';
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

export const shouldExclude = (company: string): boolean => {
  const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
  return normalizedCompany.includes('프로그램');
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

  // 1. restaurantName이 있으면 restaurant
  if (restaurantName) return 'restaurant';

  // 2. 서리펫 또는 도그마루면 pet
  if (companyNorm.includes(norm('서리펫')) || sheetTypeCanon === 'dogmaru') {
    return 'pet';
  }

  // 3. 나머지는 basic
  return 'basic';
};
