import { JOB_REGISTRY, type JobDefinition } from './job-registry';
import { EXPOSURE_TARGETS, type ExposureTargetId } from '@/shared';
import type { CafeCheck, RunBundle, TenantPreset } from './preset';
import { parseSheetIdFromUrl } from './preset';
import { parseNaverTargetInputs } from './naver-target-input';

/**
 * 각 실행 항목이 어느 프리셋 대상을 필요로 하는지.
 *
 * 화면은 로그인한 회원이 실제로 돌릴 수 있는 것만 보여야 한다. 여태는 프리셋과
 * 무관하게 16개가 전부 떴고, 눌러도 21lab 설정으로 돌았다.
 *
 * 값이 빈 배열이면 "대상과 무관한 도구"라는 뜻이고, 값이 있으면 그중 하나라도
 * 프리셋에 켜져 있어야 보인다.
 */
export const JOB_REQUIRED_TARGETS: Record<string, readonly string[]> = {
  'package-exposure': ['package'],
  'general-exposure': ['general'],
  'dogmaru-exposure': ['dogmaru'],
  'root-exposure': ['root'],
  'pet-exposure': ['pet'],
  'pet-exposure-9-direct': ['pet'],
  'suripet-exposure': ['suripet'],
  'cafe-exposure': ['cafe'],
  'cafe-only-exposure': ['cafe'],

  // 루트 키워드를 훑으므로 루트 대상이 있어야 의미가 있다.
  'root-cafe-url-exposure': ['root'],

  // 더보기 묶음 버튼은 세 대상을 한 번에 돈다. 하나라도 있으면 보인다.
  'package-general-dogmaru-more-exposure': [
    'package-more',
    'general-more',
    'dogmaru-more',
  ],
  'root-more-exposure': ['root-more'],
  'dogmaru-more-finalize': ['dogmaru-more'],

  // 이미 끝난 결과를 다시 내보내는 도구. 내보낼 대상이 하나라도 있어야 한다.
  'reexport-current-exposure': EXPOSURE_TARGETS.map(({ id }) => id),
  'reexport-current-cafe': ['cafe'],

  // 전체 실행은 7개 대상 중 켜진 것만 돈다.
  'exposure-suite': EXPOSURE_TARGETS.map(({ id }) => id),
};

/** 프리셋에서 실제로 켜져 있는 대상 id. */
export const getEnabledTargetIds = (preset: TenantPreset): Set<string> =>
  new Set(
    preset.targets
      .filter(({ enabled }) => enabled)
      .map(({ id }) => String(id ?? '').trim())
      .filter(Boolean),
  );

/** 전체 실행 화면에 띄울 대상. 프리셋에 켜진 것만 남긴다. */
export const getSuiteTargetsForPreset = (
  preset: TenantPreset,
): typeof EXPOSURE_TARGETS[number][] => {
  const enabled = getEnabledTargetIds(preset);
  return EXPOSURE_TARGETS.filter(({ id }) => enabled.has(id));
};

export const getSuiteTargetIdsForPreset = (
  preset: TenantPreset,
): ExposureTargetId[] => getSuiteTargetsForPreset(preset).map(({ id }) => id);

/** 이 회원이 이 항목을 돌릴 수 있나. */
export const canMemberRunJob = (
  preset: TenantPreset,
  jobId: string,
): boolean => {
  if (jobId.startsWith(CAFE_CHECK_JOB_PREFIX)) {
    return findCafeCheck(preset, jobId) !== undefined;
  }

  const required = JOB_REQUIRED_TARGETS[jobId];
  // 매핑에 없는 항목은 숨긴다. 새 잡을 추가하면서 매핑을 빠뜨렸을 때, 아무에게나
  // 보이는 것보다 아무에게도 안 보이는 쪽이 낫다(테스트가 이 상태를 잡아준다).
  if (!required) return false;
  if (required.length === 0) return true;

  const enabled = getEnabledTargetIds(preset);
  return required.some((target) => enabled.has(target));
};

export const getJobsForPreset = (preset: TenantPreset): JobDefinition[] => [
  ...JOB_REGISTRY.filter(({ id }) => canMemberRunJob(preset, id)),
  ...buildCafeCheckJobs(preset),
];

export interface ResolvedRunBundle {
  id: string;
  label: string;
  /** 지금 실제로 돌릴 수 있는 대상만 남긴 것. */
  targets: ExposureTargetId[];
  maxPages?: number;
  /** 묶어둔 대상 중 지금 꺼져 있어 빠진 것. 버튼 옆에 이유로 보여준다. */
  droppedTargets: string[];
}

/**
 * 저장된 실행 묶음을 지금 상태로 해석한다.
 *
 * 묶음을 만든 뒤 대상을 끄면 그 묶음은 없는 대상을 가리키게 된다. 눌러서 400을
 * 받는 대신, 꺼진 대상은 미리 빼고 무엇이 빠졌는지 같이 알려준다.
 */
export const resolveRunBundles = (preset: TenantPreset): ResolvedRunBundle[] => {
  const suiteIds = new Set<string>(getSuiteTargetIdsForPreset(preset));
  return (preset.runBundles ?? []).map((bundle: RunBundle) => {
    const targets = bundle.targets.filter((target) => suiteIds.has(target));
    return {
      id: bundle.id,
      label: bundle.label,
      targets: targets as ExposureTargetId[],
      maxPages: bundle.maxPages,
      droppedTargets: bundle.targets.filter((target) => !suiteIds.has(target)),
    };
  });
};

export const CAFE_CHECK_JOB_PREFIX = 'cafe-check:';

/**
 * 직접 만든 카페 체크를 실행 항목으로 바꾼다.
 *
 * 레지스트리는 고정 목록이라 여기 없다. 회원마다 다르므로 목록을 내려줄 때 붙인다.
 */
/** 무엇을 확인하는 체크인지 한 줄로. 카페와 블로그를 나눠 센다. */
const describeCafeCheck = (check: CafeCheck): string => {
  const { cafeIds, blogIds } = parseNaverTargetInputs(check.targets);
  const parts = [
    cafeIds.length > 0 ? `카페 ${cafeIds.length}곳` : '',
    blogIds.length > 0 ? `블로그 ${blogIds.length}곳` : '',
  ].filter(Boolean);
  return `${check.tabTitle} 탭의 키워드로 ${parts.join(' · ') || '지정한 곳'} 노출을 확인합니다`;
};

export const buildCafeCheckJobs = (preset: TenantPreset): JobDefinition[] =>
  (preset.cafeChecks ?? []).map((check) => ({
    id: `${CAFE_CHECK_JOB_PREFIX}${check.id}`,
    label: check.label,
    script: 'cafe:check',
    description: describeCafeCheck(check),
    kind: 'cafe-check' as const,
    section: 'daily' as const,
    resourceGroup: 'exposure' as const,
  }));

export const findCafeCheck = (preset: TenantPreset, jobId: string) => {
  if (!jobId.startsWith(CAFE_CHECK_JOB_PREFIX)) return undefined;
  const checkId = jobId.slice(CAFE_CHECK_JOB_PREFIX.length);
  return (preset.cafeChecks ?? []).find((check) => check.id === checkId);
};

/**
 * 봇 스크립트에 넘길 환경변수.
 *
 * check-cafe-exposure.ts는 키워드를 CAFE_SOURCE_*에서 읽고 결과를 CAFE_SHEET_*에
 * 쓴다. 사용자가 시트를 하나만 정하므로 둘 다 같은 곳을 가리킨다.
 */
export const buildCafeCheckEnv = (check: CafeCheck): Record<string, string> => {
  const { cafeIds, blogIds } = parseNaverTargetInputs(check.targets);
  // 키워드를 읽는 시트와 결과를 쓰는 시트가 실제로 같은 곳을 가리키게 한다.
  // CAFE_SHEET_ID를 비워두면 check-cafe-exposure.ts가 하드코딩된 기본 시트로
  // 결과를 써버려서, 사용자가 UI에 지정한 시트가 아닌 곳에 쓰였다.
  // 마찬가지로 소스도 CAFE_SOURCE_SHEET_ID를 비워두면 안 된다. 자식 프로세스가
  // 루트 .env에서 물려받은 CAFE_SOURCE_SHEET_ID(다른 하드코딩된 시트)가 이미
  // process.env에 있으면, getSourceSheetConfig()가 URL 파싱보다 그 값을 먼저
  // 쓰기 때문에 소스 시트조차 사용자가 지정한 곳이 아니게 된다.
  const sheetId = parseSheetIdFromUrl(check.sheetUrl);
  return {
    CAFE_SOURCE_SHEET_ID: sheetId,
    CAFE_SOURCE_SHEET_URL: check.sheetUrl,
    CAFE_SOURCE_SHEET_NAME: check.tabTitle,
    CAFE_SOURCE_SHEET_GID: '',
    CAFE_SHEET_ID: sheetId,
    CAFE_SHEET_NAME: check.tabTitle,
    CAFE_SHEET_GID: '',
    // 이름이 아니라 아이디로 넘긴다. 이름 매칭은 부분 문자열까지 맞다고 봐서
    // 짧은 이름이면 남의 카페가 걸린다.
    CAFE_TARGET_IDS: cafeIds.join(','),
    CAFE_TARGET_NAMES: '',
    BLOG_TARGET_IDS: blogIds.join(','),
  };
};
