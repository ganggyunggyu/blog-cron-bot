import { ExposureResult } from '../../matcher';
import { VendorMatchDetails } from '../../types';
import {
  extractPostVendorNames,
  fetchResolvedPostHtml,
} from '../vendor-extractor';

/** 도그마루 전용 블로그 ID - 이 블로그면 바로 노출 인정 */
const DOGMARU_BLOG_IDS = ['alien8118', 'disadvantage6171', 'weddindg1218', 'compare14310', 'tpeany'];

/** 서리펫 전용 블로그 ID - 이 블로그면 바로 노출 인정 */
const SEORIPET_BLOG_IDS = ['loand3324', 'fail5644', 'hotelelena'];

/** 블로그 링크에서 블로그 ID 추출 */
const extractBlogId = (postLink: string): string | null => {
  // https://blog.naver.com/blogId/postNo 형식
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
      // 도그마루: 전용 블로그 ID만으로 검증 (지도 로직 제외)
      if (vendorTarget === '도그마루') {
        const blogId = extractBlogId(candidate.postLink);
        if (blogId && DOGMARU_BLOG_IDS.includes(blogId)) {
          candidatePassed = true;
          candidateSource = 'VENDOR';
          candidateVendor = '도그마루(전용블로그)';
        }
        // 전용 블로그가 아니면 다음 후보로 (VENDOR/TITLE 체크 건너뜀)
        if (!candidatePassed) continue;
      }

      // 서리펫: 전용 블로그 ID만으로 검증 (지도 로직 제외)
      else if (vendorTarget === '서리펫') {
        const blogId = extractBlogId(candidate.postLink);
        if (blogId && SEORIPET_BLOG_IDS.includes(blogId)) {
          candidatePassed = true;
          candidateSource = 'VENDOR';
          candidateVendor = '서리펫(전용블로그)';
        }
        // 전용 블로그가 아니면 다음 후보로 (VENDOR/TITLE 체크 건너뜀)
        if (!candidatePassed) continue;
      }

      // 일반 업체: 기존 VENDOR/TITLE 검증 로직
      else {
        // VENDOR 체크
        try {
          const candidateHtml = await fetchResolvedPostHtml(candidate.postLink);
          const candidateVendors = extractPostVendorNames(candidateHtml);

          // 모든 업체명에 대해 매칭 체크
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

          // 매칭 안 됐어도 첫 번째 업체명은 기록
          if (!candidateVendor && candidateVendors.length > 0) {
            candidateVendor = candidateVendors[0];
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
  _restaurantName: string,
  queueIdx: number
): { matched: boolean; details?: VendorMatchDetails } => {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  const rnNorm = normalize(vendorTarget);
  // "점", "본점", "지점"만 제거 (위치 정보는 유지)
  // 청기와타운 종로점 → 청기와타운종로 (종로 유지)
  const baseBrand = vendorTarget
    .replace(/(본점|지점)$/u, '')
    .replace(/점$/u, '')
    .trim();
  const baseBrandNorm = normalize(baseBrand);
  const vNorm = normalize(extractedVendor);

  // check1: 전체 이름 매칭 (벤더가 타겟 포함)
  const check1 = vNorm.includes(rnNorm);
  // check2: 지점 접미사만 제거 후 매칭 (위치 정보 유지)
  const check2 = baseBrandNorm.length >= 2 && vNorm.includes(baseBrandNorm);
  // check3: 역방향 - 타겟이 벤더 포함 (벤더가 브랜드명만인 경우)
  // 예: "키즈나 홍대" vs "키즈나"
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

/**
 * 제목 매칭 체크
 */
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
  // "점", "본점", "지점"만 제거 (위치 정보는 유지)
  const baseBrand = vendorTarget
    .replace(/(본점|지점)$/u, '')
    .replace(/점$/u, '')
    .trim();
  const baseBrandNorm = normalize(baseBrand);

  // check1: 전체 이름 매칭
  const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
  // check2: 지점 접미사만 제거 후 매칭 (위치 정보 유지)
  const hasBrand = baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm);

  return hasFull || hasBrand;
};
