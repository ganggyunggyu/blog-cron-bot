import { InvalidJobInputError } from './job-errors';
import { EXPOSURE_TARGETS, type ExposureTargetId } from '@/shared';

const IS_DISTRIBUTED_EXPOSURE_ENABLED =
  process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true';

export const EXPOSURE_SUITE_OPTION_DEFINITION = {
  targets: EXPOSURE_TARGETS,
  concurrency: { label: '전체 요청 병렬 수', min: 1, max: 8, defaultValue: 8 },
  maxPages: { label: '애견·서리펫 최대 페이지', min: 1, max: 9, defaultValue: 4 },
  targetConcurrency: {
    label: IS_DISTRIBUTED_EXPOSURE_ENABLED ? '예비 로컬 워커 수' : '동시 대상 수',
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

const parseTargets = (value: unknown): ExposureTargetId[] => {
  if (value === undefined) {
    return EXPOSURE_TARGETS.map(({ id }) => id);
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidJobInputError('노출체크 대상을 1개 이상 선택해야 함');
  }
  if (!value.every((target) => typeof target === 'string' && ALLOWED_TARGET_IDS.has(target as ExposureTargetId))) {
    throw new InvalidJobInputError('허용되지 않은 노출체크 대상이 포함됨');
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

const parseExposureSuiteOptions = (input: unknown): ExposureSuiteOptions => {
  if (input !== undefined && !isRecord(input)) {
    throw new InvalidJobInputError('잡 옵션은 JSON 객체여야 함');
  }

  const options = input ?? {};
  const unknownKeys = Object.keys(options).filter((key) => !ALLOWED_OPTION_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new InvalidJobInputError(`허용되지 않은 잡 옵션: ${unknownKeys.join(', ')}`);
  }

  return {
    targets: parseTargets(options.targets),
    concurrency: parseInteger(options.concurrency, EXPOSURE_SUITE_OPTION_DEFINITION.concurrency),
    maxPages: parseInteger(options.maxPages, EXPOSURE_SUITE_OPTION_DEFINITION.maxPages),
    targetConcurrency: parseInteger(
      options.targetConcurrency,
      EXPOSURE_SUITE_OPTION_DEFINITION.targetConcurrency,
    ),
  };
};

export const buildExposureSuiteArgs = (input: unknown): string[] => {
  const options = parseExposureSuiteOptions(input);
  return [
    `--targets=${options.targets.join(',')}`,
    `--concurrency=${options.concurrency}`,
    `--max-pages=${options.maxPages}`,
    `--target-concurrency=${options.targetConcurrency}`,
  ];
};
