export const EXPOSURE_TARGET_IDS = [
  'package',
  'general',
  'dogmaru',
  'root',
  'pet',
  'suripet',
  'cafe',
] as const;

export type ExposureTargetId = (typeof EXPOSURE_TARGET_IDS)[number];

export const DEFAULT_EXPOSURE_TARGETS: ExposureTargetId[] = [
  ...EXPOSURE_TARGET_IDS,
];

export interface ExposureSuiteOptions {
  targets: ExposureTargetId[];
  concurrency: number;
  maxPages: number;
  targetConcurrency: number;
}

export interface TargetCommand {
  script: string;
  args: string[];
}

export interface ExposureTargetJob {
  targets: ExposureTargetId[];
  command: TargetCommand;
}

const TARGET_COMMANDS: Record<ExposureTargetId, TargetCommand> = {
  package: { script: 'cron:sheet', args: ['package'] },
  general: { script: 'cron:exclude', args: [] },
  dogmaru: { script: 'cron:dogmaru', args: [] },
  root: { script: 'cron:root', args: [] },
  pet: { script: 'cron:pages', args: ['pet'] },
  suripet: { script: 'cron:pages', args: ['suripet'] },
  cafe: { script: 'cafe:schedule:run', args: [] },
};

const findArgValue = (args: string[], name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const parseRangedInteger = (
  rawValue: string | undefined,
  fallback: number,
  label: string,
  min: number,
  max: number
): number => {
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}은 ${min}~${max} 정수여야 함`);
  }

  return value;
};

const parseTargets = (rawValue?: string): ExposureTargetId[] => {
  if (!rawValue) return [...DEFAULT_EXPOSURE_TARGETS];

  const targets = Array.from(
    new Set(rawValue.split(',').map((value) => value.trim()).filter(Boolean))
  );
  const invalidTargets = targets.filter(
    (target) => !EXPOSURE_TARGET_IDS.includes(target as ExposureTargetId)
  );

  if (invalidTargets.length > 0 || targets.length === 0) {
    throw new Error(
      `허용되지 않은 노출체크 대상: ${invalidTargets.join(', ') || '(없음)'}`
    );
  }

  return targets as ExposureTargetId[];
};

export const parseExposureSuiteOptions = (
  args: string[],
  env: NodeJS.ProcessEnv
): ExposureSuiteOptions => ({
  targets: parseTargets(
    findArgValue(args, 'targets') ?? env.EXPOSURE_TARGETS
  ),
  concurrency: parseRangedInteger(
    findArgValue(args, 'concurrency') ?? env.EXPOSURE_CONCURRENCY,
    8,
    '전체 병렬 예산',
    1,
    8
  ),
  maxPages: parseRangedInteger(
    findArgValue(args, 'max-pages') ?? env.EXPOSURE_MAX_PAGES,
    4,
    '최대 페이지',
    1,
    9
  ),
  targetConcurrency: parseRangedInteger(
    findArgValue(args, 'target-concurrency') ??
      env.EXPOSURE_TARGET_CONCURRENCY,
    2,
    '동시 대상 또는 예비 워커 수',
    1,
    3
  ),
});

export const resolveTargetCommand = (
  target: ExposureTargetId
): TargetCommand => ({
  script: TARGET_COMMANDS[target].script,
  args: [...TARGET_COMMANDS[target].args],
});

export const planExposureTargetJobs = (
  targets: readonly ExposureTargetId[]
): ExposureTargetJob[] => {
  const dogPetCompositeTargets: ExposureTargetId[] = [
    'dogmaru',
    'pet',
    'suripet',
  ];
  const shouldCombineDogPetTargets = dogPetCompositeTargets.every((target) =>
    targets.includes(target)
  );
  const shouldCombinePetTargets =
    !shouldCombineDogPetTargets &&
    targets.includes('pet') &&
    targets.includes('suripet');
  let combinedDogPetTargetsAdded = false;
  let combinedPetTargetsAdded = false;

  return targets.flatMap((target) => {
    if (
      shouldCombineDogPetTargets &&
      dogPetCompositeTargets.includes(target)
    ) {
      if (combinedDogPetTargetsAdded) return [];
      combinedDogPetTargetsAdded = true;
      return [
        {
          targets: [...dogPetCompositeTargets],
          command: {
            script: 'cron:pages',
            args: ['dogmaru,pet,suripet'],
          },
        },
      ];
    }

    if (
      shouldCombinePetTargets &&
      (target === 'pet' || target === 'suripet')
    ) {
      if (combinedPetTargetsAdded) return [];
      combinedPetTargetsAdded = true;
      return [
        {
          targets: ['pet', 'suripet'],
          command: { script: 'cron:pages', args: ['pet,suripet'] },
        },
      ];
    }

    return [{ targets: [target], command: resolveTargetCommand(target) }];
  });
};

export const buildTargetEnvironment = (
  baseEnvironment: NodeJS.ProcessEnv,
  targets: readonly ExposureTargetId[],
  concurrency: number,
  maxPages: number
): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {
    ...baseEnvironment,
    EXPOSURE_CONCURRENCY: String(concurrency),
    PAGE_CHECK_CONCURRENCY: String(concurrency),
    CHECK_CONCURRENCY: String(concurrency),
    CAFE_CHECK_CONCURRENCY: String(concurrency),
    EXPOSURE_KEYWORD_BATCH_SIZE: '50',
    FAST_EXPOSURE_MODE: 'true',
  };

  delete environment.EXPOSURE_MAX_PAGES;
  delete environment.PAGE_CHECK_MAX_PAGES;
  delete environment.ONLY_SHEET_TYPE;

  if (targets.some((target) => target === 'pet' || target === 'suripet')) {
    environment.EXPOSURE_MAX_PAGES = String(maxPages);
    environment.PAGE_CHECK_MAX_PAGES = String(maxPages);
  }

  if (targets.length === 1) {
    environment.EXPOSURE_PROGRESS_TARGET = targets[0];
  } else {
    delete environment.EXPOSURE_PROGRESS_TARGET;
  }

  return environment;
};
