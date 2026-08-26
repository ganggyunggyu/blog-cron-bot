import { JOB_REGISTRY, type JobDefinition } from './job-registry';
import { EXPOSURE_TARGETS, type ExposureTargetId } from '@/shared';
import type { RunBundle, TenantPreset } from './preset';

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
  const required = JOB_REQUIRED_TARGETS[jobId];
  // 매핑에 없는 항목은 숨긴다. 새 잡을 추가하면서 매핑을 빠뜨렸을 때, 아무에게나
  // 보이는 것보다 아무에게도 안 보이는 쪽이 낫다(테스트가 이 상태를 잡아준다).
  if (!required) return false;
  if (required.length === 0) return true;

  const enabled = getEnabledTargetIds(preset);
  return required.some((target) => enabled.has(target));
};

export const getJobsForPreset = (preset: TenantPreset): JobDefinition[] =>
  JOB_REGISTRY.filter(({ id }) => canMemberRunJob(preset, id));

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
