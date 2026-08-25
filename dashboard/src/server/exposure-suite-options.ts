import { InvalidJobInputError } from './job-errors';
import { EXPOSURE_TARGETS, type ExposureTargetId } from '@/shared';

const IS_DISTRIBUTED_EXPOSURE_ENABLED =
  process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true';

export const EXPOSURE_SUITE_OPTION_DEFINITION = {
  targets: EXPOSURE_TARGETS,
  concurrency: { label: '한 시트에서 동시에 볼 키워드 수', min: 1, max: 50, defaultValue: 50 },
  maxPages: { label: '애견·서리펫 최대 페이지', min: 1, max: 9, defaultValue: 1 },
  targetConcurrency: {
    label: '한 번에 돌릴 시트 수',
    min: 1,
    max: 3,
    defaultValue: IS_DISTRIBUTED_EXPOSURE_ENABLED ? 1 : 2,
  },
} as const;

interface ExposureSuiteOptions {
  targets: ExposureTargetId[];
  concurrency: number;
  maxPages: number;
  targetConcurrency: number;
}

const ALLOWED_OPTION_KEYS = new Set([
  'targets',
  'concurrency',
  'maxPages',
  'targetConcurrency',
]);
const ALLOWED_TARGET_IDS = new Set<ExposureTargetId>(
  EXPOSURE_TARGETS.map(({ id }) => id),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 이 실행에서 고를 수 있는 대상.
 *
 * allowed가 넘어오면 그 회원의 프리셋에 켜진 대상만 허용한다. 화면에서 못 고르게
 * 하는 것만으로는 부족하다 - 요청은 직접 만들어 보낼 수 있고, 남의 시트를 도는
 * 실행이 되면 안 된다.
 */
const parseTargets = (
  value: unknown,
  allowed: readonly ExposureTargetId[] | undefined,
): ExposureTargetId[] => {
  const allowedIds = allowed
    ? new Set<ExposureTargetId>(allowed)
    : ALLOWED_TARGET_IDS;
  if (allowedIds.size === 0) {
    throw new InvalidJobInputError(
      '이 계정에 켜진 노출체크 대상이 없음. 설정에서 대상을 먼저 켜야 함',
    );
  }

  if (value === undefined) {
    return EXPOSURE_TARGETS.map(({ id }) => id).filter((id) =>
      allowedIds.has(id),
    );
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidJobInputError('노출체크 대상을 1개 이상 선택해야 함');
  }
  if (!value.every((target) => typeof target === 'string' && allowedIds.has(target as ExposureTargetId))) {
    throw new InvalidJobInputError('이 계정에서 돌릴 수 없는 노출체크 대상이 포함됨');
  }
  if (new Set(value).size !== value.length) {
    throw new InvalidJobInputError('노출체크 대상은 중복될 수 없음');
  }
  return value as ExposureTargetId[];
};

const parseInteger = (
  value: unknown,
  definition: { label: string; min: number; max: number; defaultValue: number },
): number => {
  if (value === undefined) return definition.defaultValue;
  if (!Number.isInteger(value) || (value as number) < definition.min || (value as number) > definition.max) {
    throw new InvalidJobInputError(
      `${definition.label}은 ${definition.min}~${definition.max} 정수여야 함`,
    );
  }
  return value as number;
};

const parseExposureSuiteOptions = (
  input: unknown,
  allowedTargets?: readonly ExposureTargetId[],
): ExposureSuiteOptions => {
  if (input !== undefined && !isRecord(input)) {
    throw new InvalidJobInputError('실행 옵션 형식이 잘못됨');
  }

  const options = input ?? {};
  const unknownKeys = Object.keys(options).filter((key) => !ALLOWED_OPTION_KEYS.has(key));
  if (unknownKeys.length > 0) {
    // 키 이름(targetConcurrency 같은)은 코드 식별자라 화면에 내보내지 않는다.
    console.error(`허용되지 않은 실행 옵션 키: ${unknownKeys.join(', ')}`);
    throw new InvalidJobInputError('화면이 보내면 안 되는 실행 옵션이 들어옴');
  }

  return {
    targets: parseTargets(options.targets, allowedTargets),
    concurrency: parseInteger(options.concurrency, EXPOSURE_SUITE_OPTION_DEFINITION.concurrency),
    maxPages: parseInteger(options.maxPages, EXPOSURE_SUITE_OPTION_DEFINITION.maxPages),
    targetConcurrency: parseInteger(
      options.targetConcurrency,
      EXPOSURE_SUITE_OPTION_DEFINITION.targetConcurrency,
    ),
  };
};

export const buildExposureSuiteArgs = (
  input: unknown,
  allowedTargets?: readonly ExposureTargetId[],
): string[] => {
  const options = parseExposureSuiteOptions(input, allowedTargets);
  return [
    `--targets=${options.targets.join(',')}`,
    `--concurrency=${IS_DISTRIBUTED_EXPOSURE_ENABLED ? 0 : options.concurrency}`,
    `--max-pages=${options.maxPages}`,
    `--target-concurrency=${options.targetConcurrency}`,
  ];
};
