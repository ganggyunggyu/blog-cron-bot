import {
  DOG_PET_COMPOSITE_TARGETS,
  PAGE_CHECK_SHEET_TYPES,
  PAGE_CHECK_SHEET_TYPE_NAMES,
  PAGE_CHECK_TARGET_NAMES,
  type PageCheckRunTarget,
} from './config';

export interface PageCheckTargetSelection {
  targetSheetTypes?: PageCheckRunTarget[];
  notice?: string;
  error?: string;
}

const parseRequestedTargets = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((target) => target.trim())
        .filter(Boolean)
    )
  );

export const selectPageCheckTargets = (
  args: string[]
): PageCheckTargetSelection => {
  const excludeIndex = args.indexOf('--exclude');
  if (excludeIndex !== -1 && args[excludeIndex + 1]) {
    const excludeType = args[excludeIndex + 1];
    if (PAGE_CHECK_SHEET_TYPES.includes(excludeType as 'pet' | 'suripet')) {
      return {
        targetSheetTypes: PAGE_CHECK_SHEET_TYPES.filter(
          (sheetType) => sheetType !== excludeType
        ),
        notice: `🚫 제외 모드: ${PAGE_CHECK_SHEET_TYPE_NAMES[excludeType as 'pet' | 'suripet']} 제외`,
      };
    }

    return { error: `❌ 유효하지 않은 sheetType: ${excludeType}` };
  }

  const requested = parseRequestedTargets(args[0] ?? '');
  if (requested.length === 0) return {};

  const availableTargets: PageCheckRunTarget[] = [
    ...PAGE_CHECK_SHEET_TYPES,
    'dogmaru',
  ];
  const invalidTargets = requested.filter(
    (target) => !availableTargets.includes(target as PageCheckRunTarget)
  );
  const requestsDogmaru = requested.includes('dogmaru');
  const isExactDogPetComposite =
    requested.length === DOG_PET_COMPOSITE_TARGETS.length &&
    DOG_PET_COMPOSITE_TARGETS.every((target) => requested.includes(target));

  if (
    invalidTargets.length > 0 ||
    (requestsDogmaru && !isExactDogPetComposite)
  ) {
    return {
      error: `❌ 유효하지 않은 sheetType 조합: ${invalidTargets.join(', ') || args[0]}`,
    };
  }

  const targetSheetTypes = requested as PageCheckRunTarget[];
  return {
    targetSheetTypes,
    notice: `🎯 대상 시트: ${targetSheetTypes
      .map((target) => PAGE_CHECK_TARGET_NAMES[target])
      .join(', ')}`,
  };
};

export const getPageCheckUsage = (): string =>
  `사용 가능: ${PAGE_CHECK_SHEET_TYPES.join(', ')} 또는 dogmaru,pet,suripet`;
