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

export const shouldExclude = (company: string, keyword?: string): boolean => {
  const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
  if (normalizedCompany.includes('프로그램')) return true;

  // 자료 미전달 키워드 제외
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

  // 1. restaurantName이 있으면 restaurant
  if (restaurantName) return 'restaurant';

  // 2. 서리펫 또는 도그마루면 pet
  if (companyNorm.includes(norm('서리펫')) || sheetTypeCanon === 'dogmaru') {
    return 'pet';
  }

  // 3. 나머지는 basic
  return 'basic';
};

/** 주제 목록으로 isNewLogic 판단 (기본값만 있으면 새 로직) */
const DEFAULT_TOPICS = ['인기글', '스니펫', '스니펫 이미지'];

export const getIsNewLogic = (topicNames: string[]): boolean => {
  if (topicNames.length === 0) return false;
  return topicNames.every((topic) => DEFAULT_TOPICS.includes(topic));
};
