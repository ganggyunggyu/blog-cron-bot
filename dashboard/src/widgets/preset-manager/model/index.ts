import {
  CHECK_KINDS,
  type BlogGroup,
  type CheckKind,
  type PresetTarget,
  type RunBundle,
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

/** 비슷한 대상을 하나 더 만들 때. id는 겹치면 저장이 막히므로 새로 딴다. */
export const duplicateTargetAt = (
  targets: PresetTarget[],
  index: number,
): PresetTarget[] => {
  const origin = targets[index];
  if (!origin) return targets;

  const taken = new Set(targets.map(({ id }) => id));
  let copyId = `${origin.id}-copy`;
  let suffix = 2;
  while (taken.has(copyId)) {
    copyId = `${origin.id}-copy${suffix}`;
    suffix += 1;
  }

  const copy: PresetTarget = {
    ...origin,
    id: copyId,
    label: `${origin.label} 복사본`,
    source: { ...origin.source },
    result: origin.result ? { ...origin.result } : undefined,
    blogGroupIds: origin.blogGroupIds ? [...origin.blogGroupIds] : undefined,
    blogIds: origin.blogIds ? [...origin.blogIds] : undefined,
  };

  return [...targets.slice(0, index + 1), copy, ...targets.slice(index + 1)];
};

/** 실행 순서가 곧 목록 순서라 위아래로 옮길 수 있어야 한다. */
export const moveTarget = (
  targets: PresetTarget[],
  index: number,
  offset: number,
): PresetTarget[] => {
  const next = index + offset;
  if (index < 0 || index >= targets.length) return targets;
  if (next < 0 || next >= targets.length) return targets;

  const reordered = [...targets];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(next, 0, moved);
  return reordered;
};

/** 대상이 많아지면 이름보다 시트 탭으로 찾는 일이 잦아 둘 다 본다. */
export const matchesTargetQuery = (
  target: PresetTarget,
  query: string,
): boolean => {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  return [
    target.label,
    target.id,
    target.source.tabTitle,
    target.source.sheetId,
    target.result?.tabTitle ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
};

/** 붙여넣기로 들어온 계정을 기존 목록 뒤에 붙인다. 중복은 뒤엣것을 버린다. */
export const mergeBlogIds = (
  current: string[] | undefined,
  incoming: string[],
): string[] => Array.from(new Set([...(current ?? []), ...incoming]));

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
    // 저장 전에 정리한다. 대상이 하나도 없는 묶음은 서버 검증에서 걸리고, 지운 대상을
  // 가리키는 묶음도 마찬가지다. 화면에서 실수한 걸 저장 실패로 알려주는 대신 치운다.
  runBundles: (() => {
    const targetIds = new Set(preset.targets.map(({ id }) => id));
    const cleaned = (preset.runBundles ?? [])
      .map((bundle) => ({
        ...bundle,
        label: bundle.label.trim(),
        targets: bundle.targets.filter((id) => targetIds.has(id)),
      }))
      .filter(({ label, targets }) => label.length > 0 && targets.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  })(),
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
export const createEmptyBundle = (existing: RunBundle[]): RunBundle => {
  const used = new Set(existing.map(({ id }) => id));
  let index = existing.length + 1;
  while (used.has(`bundle-${index}`)) index += 1;
  return { id: `bundle-${index}`, label: `묶음 ${index}`, targets: [] };
};

export const replaceBundle = (
  bundles: RunBundle[],
  index: number,
  next: RunBundle,
): RunBundle[] => bundles.map((bundle, i) => (i === index ? next : bundle));

export const removeBundleAt = (bundles: RunBundle[], index: number): RunBundle[] =>
  bundles.filter((_, i) => i !== index);

export const toggleBundleTarget = (bundle: RunBundle, targetId: string): RunBundle => ({
  ...bundle,
  targets: bundle.targets.includes(targetId)
    ? bundle.targets.filter((id) => id !== targetId)
    : [...bundle.targets, targetId],
});

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
