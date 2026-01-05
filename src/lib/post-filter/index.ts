import { ExposureResult } from '../../matcher';
import { VendorMatchDetails } from '../../types';
import {
  extractPostVendorNames,
  fetchResolvedPostHtml,
} from '../vendor-extractor';

const DOGMARU_BLOG_IDS = ['alien8118', 'disadvantage6171', 'weddindg1218', 'compare14310', 'tpeany'];

const SEORIPET_BLOG_IDS = ['loand3324', 'fail5644', 'hotelelena'];

const extractBlogId = (postLink: string): string | null => {
  const match = postLink.match(/blog\.naver\.com\/([^\/]+)/);
  return match ? match[1] : null;
};

interface FilterResult {
  matchedIndex: number;
  match: ExposureResult | undefined;
  passed: boolean;
  source: 'VENDOR' | 'TITLE' | '';
  vendor: string;
  vendorDetails: VendorMatchDetails | undefined;
}

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
      if (vendorTarget === '도그마루') {
        const blogId = extractBlogId(candidate.postLink);
        if (blogId && DOGMARU_BLOG_IDS.includes(blogId)) {
          candidatePassed = true;
          candidateSource = 'VENDOR';
          candidateVendor = '도그마루(전용블로그)';
        }
        if (!candidatePassed) continue;
      }

      else if (vendorTarget === '서리펫') {
        const blogId = extractBlogId(candidate.postLink);
        if (blogId && SEORIPET_BLOG_IDS.includes(blogId)) {
          candidatePassed = true;
          candidateSource = 'VENDOR';
          candidateVendor = '서리펫(전용블로그)';
        }
        if (!candidatePassed) continue;
      }

      else {
        try {
          const candidateHtml = await fetchResolvedPostHtml(candidate.postLink);
          const candidateVendors = extractPostVendorNames(candidateHtml);

          for (const vendor of candidateVendors) {
            if (!vendor) continue;

            const result = checkVendorMatch(
              vendor,
              vendorTarget,
              restaurantName,
              queueIdx
            );

            if (result.matched) {
              candidatePassed = true;
              candidateSource = 'VENDOR';
              candidateVendor = vendor;
              candidateVendorDetails = result.details;
              break;
            }
          }

          if (!candidateVendor && candidateVendors.length > 0) {
            candidateVendor = candidateVendors[0];
          }
        } catch (err) {
          console.warn(
            `  [VENDOR 체크 실패 (큐 ${queueIdx})] ${(err as Error).message}`
          );
        }

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
      }
    } else {
      candidatePassed = true;
      candidateSource = 'TITLE';
    }

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

const checkVendorMatch = (
  extractedVendor: string,
  vendorTarget: string,
  _restaurantName: string,
  queueIdx: number
): { matched: boolean; details?: VendorMatchDetails } => {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  const rnNorm = normalize(vendorTarget);
  const baseBrand = vendorTarget
    .replace(/(본점|지점)$/u, '')
    .replace(/점$/u, '')
    .trim();
  const baseBrandNorm = normalize(baseBrand);
  const vNorm = normalize(extractedVendor);

  const check1 = vNorm.includes(rnNorm);
  const check2 = baseBrandNorm.length >= 2 && vNorm.includes(baseBrandNorm);
  const check3 = vNorm.length >= 2 && baseBrandNorm.includes(vNorm);

  if (check1 || check2 || check3) {
    return {
      matched: true,
      details: {
        restaurantName: vendorTarget,
        baseBrand,
        brandRoot: '',
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

const checkTitleMatch = (
  postTitle: string,
  vendorTarget: string,
  _restaurantName: string
): boolean => {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  const title = postTitle.toLowerCase();
  const titleNorm = normalize(postTitle);
  const rn = vendorTarget.toLowerCase();
  const rnNorm = normalize(vendorTarget);
  const baseBrand = vendorTarget
    .replace(/(본점|지점)$/u, '')
    .replace(/점$/u, '')
    .trim();
  const baseBrandNorm = normalize(baseBrand);

  const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
  const hasBrand = baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm);

  return hasFull || hasBrand;
};
