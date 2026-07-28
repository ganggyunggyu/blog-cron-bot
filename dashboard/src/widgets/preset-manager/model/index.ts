import {
  CHECK_KINDS,
  type CheckKind,
  type PresetTarget,
  type TenantPreset,
} from '@/entities/preset';

export const isCheckKind = (value: string): value is CheckKind =>
  (CHECK_KINDS as readonly string[]).includes(value);

/** 새 대상은 어떤 시트를 볼지 사용자가 직접 채우게 빈 값으로 시작한다. */
export const createEmptyTarget = (existing: PresetTarget[]): PresetTarget => {
  const taken = new Set(existing.map(({ id }) => id));
  let index = existing.length + 1;
  while (taken.has(`target-${index}`)) index += 1;

  return {
    id: `target-${index}`,
    label: `새 대상 ${index}`,
    kind: 'basic',
    source: { sheetId: '', tabTitle: '' },
    result: { sheetId: '', tabTitle: '' },
    enabled: true,
  };
};

export const replaceTarget = (
  targets: PresetTarget[],
  index: number,
  next: PresetTarget,
): PresetTarget[] => targets.map((target, at) => (at === index ? next : target));

export const blogIdsToText = (blogIds: string[] | undefined): string =>
  (blogIds ?? []).join(', ');

export const textToBlogIds = (text: string): string[] =>
  text
    .split(/[,\n]/)
    .map((blogId) => blogId.trim())
    .filter(Boolean);

/** 저장 전에 서버와 같은 규칙으로 비워둔 쓰기 시트를 정리한다. */
export const toSavablePreset = (preset: TenantPreset): TenantPreset => ({
  ...preset,
  targets: preset.targets.map((target) => {
    const hasResult = Boolean(
      target.result?.sheetId?.trim() || target.result?.tabTitle?.trim(),
    );
    return {
      ...target,
      result: hasResult ? target.result : undefined,
      maxPages: target.kind === 'page' ? target.maxPages : undefined,
    };
  }),
});
