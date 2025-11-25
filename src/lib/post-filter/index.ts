import { ExposureResult } from '../../matcher';
import { VendorMatchDetails } from '../../types';
import {
  extractPostVendorName,
  fetchResolvedPostHtml,
} from '../vendor-extractor';

interface FilterResult {
  matchedIndex: number;
  match: ExposureResult | undefined;
  passed: boolean;
  source: 'VENDOR' | 'TITLE' | '';
  vendor: string;
  vendorDetails: VendorMatchDetails | undefined;
}

/**
 * 매칭 큐에서 vendorTarget/TITLE 필터링 통과하는 첫 번째 포스트 찾기
 */
export const findMatchingPost = async (
  matchQueue: ExposureResult[],
  vendorTarget: string,
  restaurantName: string
): Promise<FilterResult> => {
  let matchedIndex = -1;
  let nextMatch: ExposureResult | undefined;
  let passed = false;
  let matchSource: 'VENDOR' | 'TITLE' | '' = '';
  let extractedVendor = '';
  let vendorMatchDetails: VendorMatchDetails | undefined;

  for (let queueIdx = 0; queueIdx < matchQueue.length; queueIdx++) {
    const candidate = matchQueue[queueIdx];
    let candidatePassed = false;
    let candidateSource: 'VENDOR' | 'TITLE' | '' = '';
    let candidateVendor = '';
    let candidateVendorDetails: VendorMatchDetails | undefined;

    if (vendorTarget) {
      // VENDOR 체크
      try {
        const candidateHtml = await fetchResolvedPostHtml(candidate.postLink);
        candidateVendor = extractPostVendorName(candidateHtml);

        if (candidateVendor) {
          const result = checkVendorMatch(
            candidateVendor,
            vendorTarget,
            restaurantName,
            queueIdx
          );

          if (result.matched) {
            candidatePassed = true;
            candidateSource = 'VENDOR';
            candidateVendorDetails = result.details;
          }
        }
      } catch (err) {
        console.warn(
          `  [VENDOR 체크 실패 (큐 ${queueIdx})] ${(err as Error).message}`
        );
      }

      // VENDOR 실패 시 TITLE 체크
      if (!candidatePassed) {
        const titleMatched = checkTitleMatch(
          candidate.postTitle || '',
          vendorTarget,
          restaurantName
        );

        if (titleMatched) {
          candidatePassed = true;
          candidateSource = 'TITLE';
        }
      }
    } else {
      // vendorTarget 없는 경우: 일반 키워드 → 기본 노출
      candidatePassed = true;
      candidateSource = 'TITLE';
    }

    // 통과했으면 선택하고 루프 종료
    if (candidatePassed) {
      matchedIndex = queueIdx;
      nextMatch = candidate;
      passed = true;
      matchSource = candidateSource;
      extractedVendor = candidateVendor;
      vendorMatchDetails = candidateVendorDetails;
      break;
    }
  }

  return {
    matchedIndex,
    match: nextMatch,
    passed,
    source: matchSource,
    vendor: extractedVendor,
    vendorDetails: vendorMatchDetails,
  };
};

/**
 * 업체명 매칭 체크
 */
const checkVendorMatch = (
  extractedVendor: string,
  vendorTarget: string,
  restaurantName: string,
  queueIdx: number
): { matched: boolean; details?: VendorMatchDetails } => {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  const rnNorm = normalize(vendorTarget);
  const baseBrand = vendorTarget
    .replace(/(본점|지점)$/u, '')
    .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
    .trim();
  const baseBrandNorm = normalize(baseBrand);
  const brandRoot = normalize((restaurantName.split(/\s+/)[0] || '').trim());
  const vNorm = normalize(extractedVendor);

  const check1 = vNorm.includes(rnNorm);
  const check2 = baseBrandNorm.length >= 2 && vNorm.includes(baseBrandNorm);
  const check3 = brandRoot.length >= 2 && vNorm.includes(brandRoot);

  if (check1 || check2 || check3) {
    return {
      matched: true,
      details: {
        restaurantName: vendorTarget,
        baseBrand,
        brandRoot,
        extractedVendor,
        matchedBy: check1 ? 'rnNorm' : check2 ? 'baseBrandNorm' : 'brandRoot',
        checkIndex: queueIdx,
        rnNorm,
        baseBrandNorm,
      },
    };
  }

  return { matched: false };
};

/**
 * 제목 매칭 체크
 */
const checkTitleMatch = (
  postTitle: string,
  vendorTarget: string,
  restaurantName: string
): boolean => {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  const titleRaw = postTitle;
  const title = titleRaw.toLowerCase();
  const titleNorm = normalize(titleRaw);
  const rn = vendorTarget.toLowerCase();
  const rnNorm = normalize(vendorTarget);
  const baseBrand = vendorTarget
    .replace(/(본점|지점)$/u, '')
    .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
    .trim();
  const baseBrandNorm = normalize(baseBrand);
  const brandRoot = normalize((restaurantName.split(/\s+/)[0] || '').trim());

  const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
  const hasBrand =
    (baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm)) ||
    (brandRoot.length >= 2 && titleNorm.includes(brandRoot));

  return hasFull || hasBrand;
};
