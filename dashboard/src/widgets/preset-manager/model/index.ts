import {
  CHECK_KINDS,
  type BlogGroup,
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

/** 그룹 id는 저장 후에도 대상이 계속 가리키는 키라 라벨과 달리 자동 생성한다. */
export const createEmptyGroup = (existing: BlogGroup[]): BlogGroup => {
  const taken = new Set(existing.map(({ id }) => id));
  let index = existing.length + 1;
  while (taken.has(`group-${index}`)) index += 1;

  return { id: `group-${index}`, label: `새 그룹 ${index}`, blogIds: [] };
};

export const replaceGroup = (
  groups: BlogGroup[],
  index: number,
  next: BlogGroup,
): BlogGroup[] => groups.map((group, at) => (at === index ? next : group));

/** 대상들이 어떤 그룹을 몇 번 쓰는지. 지우기 전에 영향 범위를 보여주려고 센다. */
export const countGroupUsage = (
  targets: PresetTarget[],
): Record<string, number> =>
  targets.reduce<Record<string, number>>((counts, target) => {
    (target.blogGroupIds ?? []).forEach((groupId) => {
      counts[groupId] = (counts[groupId] ?? 0) + 1;
    });
    return counts;
  }, {});

/** 그룹을 지우면 그 그룹을 가리키던 대상에서도 같이 뺀다. 안 그러면 저장이 막힌다. */
export const removeGroupAt = (
  preset: TenantPreset,
  index: number,
): TenantPreset => {
  const removed = preset.blogGroups[index];
  if (!removed) return preset;

  return {
    ...preset,
    blogGroups: preset.blogGroups.filter((_, at) => at !== index),
    targets: preset.targets.map((target) => {
      const blogGroupIds = (target.blogGroupIds ?? []).filter(
        (groupId) => groupId !== removed.id,
      );
      return { ...target, blogGroupIds };
    }),
  };
};

export const toggleTargetGroup = (
  target: PresetTarget,
  groupId: string,
): PresetTarget => {
  const current = target.blogGroupIds ?? [];
  const blogGroupIds = current.includes(groupId)
    ? current.filter((id) => id !== groupId)
    : [...current, groupId];

  return { ...target, blogGroupIds };
};

export const blogIdsToText = (blogIds: string[] | undefined): string =>
  (blogIds ?? []).join(', ');

export const textToBlogIds = (text: string): string[] =>
  text
    .split(/[,\n]/)
    .map((blogId) => blogId.trim())
    .filter(Boolean);

/** 저장 전에 서버와 같은 규칙으로 비워둔 쓰기 시트와 안 쓰는 필드를 정리한다. */
export const toSavablePreset = (preset: TenantPreset): TenantPreset => ({
  ...preset,
  blogGroups: preset.blogGroups ?? [],
  targets: preset.targets.map((target) => {
    const hasResult = Boolean(
      target.result?.sheetId?.trim() || target.result?.tabTitle?.trim(),
    );
    const blogGroupIds = target.blogGroupIds ?? [];
    return {
      ...target,
      result: hasResult ? target.result : undefined,
      maxPages: target.kind === 'page' ? target.maxPages : undefined,
      blogGroupIds: blogGroupIds.length > 0 ? blogGroupIds : undefined,
    };
  }),
});
