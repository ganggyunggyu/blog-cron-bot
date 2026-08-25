/**
 * 회원 프리셋 검증.
 *
 * 저장 형식은 봇 쪽 src/lib/tenant/preset.ts와 같아야 한다. 대시보드는 봇 소스를 직접
 * import 하지 않으므로 같은 규칙을 여기에 맞춰 두고, 저장 전에 반드시 이 함수를 통과시킨다.
 * 잘못된 시트 ID나 종류가 들어가면 워커가 남의 시트를 읽거나 조용히 아무것도 안 한다.
 */
import { normalizeBlogId } from './blog-id';

export const CHECK_KINDS = ['basic', 'more', 'page'] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export const CHECK_KIND_LABELS: Record<CheckKind, string> = {
  basic: '기본 노출체크',
  more: '더보기 노출체크',
  page: '페이지 노출체크',
};

export const MAX_PAGE_DEPTH = 10;
export const MAX_BLOG_IDS_PER_GROUP = 500;

export interface SheetLocation {
  sheetId: string;
  tabTitle: string;
}

/**
 * 이름 붙인 계정 묶음. "준최", "최블", "도그마루"처럼 한 번 만들어두고
 * 여러 노출체크 대상이 골라 쓴다.
 */
export interface BlogGroup {
  id: string;
  label: string;
  blogIds: string[];
}

export interface PresetTarget {
  id: string;
  label: string;
  kind: CheckKind;
  source: SheetLocation;
  result?: SheetLocation;
  maxPages?: number;
  /** 이 대상에서 쓸 계정 그룹. 여러 개를 고르면 합집합으로 본다. */
  blogGroupIds?: string[];
  /** 그룹에 없는 계정을 이 대상에만 덧붙일 때 쓴다. */
  blogIds?: string[];
  enabled: boolean;
}

/**
 * 저장해둔 실행 묶음.
 *
 * 매번 대상 체크박스를 다시 고르는 대신, 자주 쓰는 조합에 이름을 붙여두고 버튼
 * 하나로 돌린다. 계정마다 쓰는 조합이 달라서 프리셋에 같이 저장한다.
 */
export interface RunBundle {
  id: string;
  label: string;
  /** 이 묶음이 돌릴 대상 id. 프리셋에 켜져 있는 대상만 실제로 실행된다. */
  targets: string[];
  /** 애견·서리펫에만 적용된다. 없으면 기본값을 쓴다. */
  maxPages?: number;
}

export interface TenantPreset {
  targets: PresetTarget[];
  blogGroups: BlogGroup[];
  runBundles?: RunBundle[];
  doorayWebhookUrl?: string;
}

export const EMPTY_PRESET: TenantPreset = { targets: [], blogGroups: [] };

export const MAX_RUN_BUNDLES = 12;

/**
 * 대상이 실제로 확인할 계정 목록. 고른 그룹들을 순서대로 합치고 직접 계정을 뒤에 붙인다.
 * 빈 배열이면 "전체 계정"이라는 뜻이다.
 */
export const resolveTargetBlogIds = (
  preset: TenantPreset,
  target: PresetTarget,
): string[] => {
  const byId = new Map(preset.blogGroups.map((group) => [group.id, group]));
  const fromGroups = (target.blogGroupIds ?? []).flatMap(
    (groupId) => byId.get(groupId)?.blogIds ?? [],
  );

  return Array.from(new Set([...fromGroups, ...(target.blogIds ?? [])]));
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const trimmed = (value: unknown): string => String(value ?? '').trim();

const parseSheetLocation = (
  raw: unknown,
  label: string,
  kindLabel: string,
): SheetLocation => {
  const { sheetId, tabTitle } = asRecord(raw);
  const parsedSheetId = trimmed(sheetId);
  const parsedTabTitle = trimmed(tabTitle);

  if (!parsedSheetId) {
    throw new Error(`${label}: ${kindLabel} 시트 ID가 비어 있음`);
  }
  if (!parsedTabTitle) {
    throw new Error(`${label}: ${kindLabel} 탭 이름이 비어 있음`);
  }

  return { sheetId: parsedSheetId, tabTitle: parsedTabTitle };
};

const parseResultLocation = (
  raw: unknown,
  label: string,
): SheetLocation | undefined => {
  if (raw === undefined || raw === null) return undefined;

  const { sheetId, tabTitle } = asRecord(raw);
  // 둘 다 비면 "원본 시트에 그대로 반영"이라는 뜻이라 대상에서 아예 뺀다.
  if (!trimmed(sheetId) && !trimmed(tabTitle)) return undefined;

  return parseSheetLocation(raw, label, '쓰기');
};

const parseMaxPages = (
  raw: unknown,
  kind: CheckKind,
  label: string,
): number | undefined => {
  // 페이지 노출체크가 아니면 페이지 수가 실행에 쓰이지 않으니 저장하지 않는다.
  if (kind !== 'page') return undefined;
  if (raw === undefined || raw === null || raw === '') return undefined;

  const maxPages = Number(raw);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_PAGE_DEPTH) {
    throw new Error(`${label}: 페이지 수는 1~${MAX_PAGE_DEPTH}만 됨`);
  }

  return maxPages;
};

const normalizeBlogIdList = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? Array.from(
        new Set(raw.map(normalizeBlogId).filter((blogId) => blogId.length > 0)),
      ).slice(0, MAX_BLOG_IDS_PER_GROUP)
    : [];

const parseBlogIds = (raw: unknown): string[] | undefined => {
  const blogIds = normalizeBlogIdList(raw);
  return blogIds.length > 0 ? blogIds : undefined;
};

const parseBlogGroups = (raw: unknown): BlogGroup[] => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('계정 그룹 목록이 배열이 아님');

  const groups = raw.map((entry, index) => {
    const { id, label, blogIds } = asRecord(entry);
    const parsedId = trimmed(id);
    if (!parsedId) throw new Error(`${index + 1}번째 계정 그룹: id가 비어 있음`);

    return {
      id: parsedId,
      label: trimmed(label) || parsedId,
      blogIds: normalizeBlogIdList(blogIds),
    };
  });

  const seen = new Set<string>();
  groups.forEach(({ id, label }) => {
    if (seen.has(id)) throw new Error(`${label}: 계정 그룹 id "${id}"가 중복됨`);
    seen.add(id);
  });

  return groups;
};

const parseBlogGroupIds = (
  raw: unknown,
  groups: BlogGroup[],
  label: string,
): string[] | undefined => {
  if (!Array.isArray(raw)) return undefined;

  const known = new Set(groups.map((group) => group.id));
  const groupIds = Array.from(
    new Set(raw.map((groupId) => trimmed(groupId)).filter(Boolean)),
  );

  groupIds.forEach((groupId) => {
    // 없는 그룹을 가리키면 그 대상은 조용히 계정 0개로 돌아버린다.
    if (!known.has(groupId)) {
      throw new Error(`${label}: 계정 그룹 "${groupId}"가 없음`);
    }
  });

  return groupIds.length > 0 ? groupIds : undefined;
};

const parseTarget = (
  raw: unknown,
  index: number,
  groups: BlogGroup[],
): PresetTarget => {
  const {
    id,
    label,
    kind,
    source,
    result,
    maxPages,
    blogGroupIds,
    blogIds,
    enabled,
  } = asRecord(raw);

  const parsedId = trimmed(id);
  const position = `${index + 1}번째 대상`;
  if (!parsedId) throw new Error(`${position}: 대상 id가 비어 있음`);

  const parsedLabel = trimmed(label) || parsedId;
  const parsedKind = trimmed(kind) as CheckKind;
  if (!CHECK_KINDS.includes(parsedKind)) {
    throw new Error(`${parsedLabel}: 노출체크 종류가 기본/더보기/페이지가 아님`);
  }

  const target: PresetTarget = {
    id: parsedId,
    label: parsedLabel,
    kind: parsedKind,
    source: parseSheetLocation(source, parsedLabel, '읽기'),
    enabled: enabled !== false,
  };

  // 값이 없는 optional 필드는 키 자체를 넣지 않는다. undefined로 넘기면 MongoDB가
  // null로 바꿔 저장하고, 그 null을 다시 읽는 쪽이 "설정된 값"으로 오해한다.
  const parsedResult = parseResultLocation(result, parsedLabel);
  if (parsedResult) target.result = parsedResult;

  const parsedMaxPages = parseMaxPages(maxPages, parsedKind, parsedLabel);
  if (parsedMaxPages) target.maxPages = parsedMaxPages;

  const parsedGroupIds = parseBlogGroupIds(blogGroupIds, groups, parsedLabel);
  if (parsedGroupIds) target.blogGroupIds = parsedGroupIds;

  const parsedBlogIds = parseBlogIds(blogIds);
  if (parsedBlogIds) target.blogIds = parsedBlogIds;

  return target;
};

const parseDoorayWebhookUrl = (raw: unknown): string | undefined => {
  const url = trimmed(raw);
  if (!url) return undefined;
  if (!url.startsWith('https://')) {
    throw new Error('Dooray 웹훅은 https 주소만 됨');
  }
  return url;
};

const parseRunBundles = (
  raw: unknown,
  targetIds: ReadonlySet<string>,
): RunBundle[] => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('실행 묶음 목록이 배열이 아님');
  if (raw.length > MAX_RUN_BUNDLES) {
    throw new Error(`실행 묶음은 ${MAX_RUN_BUNDLES}개까지만 만들 수 있음`);
  }

  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const { id, label, targets, maxPages } = asRecord(entry);
    const bundleId = String(id ?? '').trim();
    const bundleLabel = String(label ?? '').trim();
    const where = bundleLabel || `${index + 1}번째 실행 묶음`;

    if (!bundleId) throw new Error(`${where}: 실행 묶음 id가 비어 있음`);
    if (!bundleLabel) throw new Error(`${index + 1}번째 실행 묶음: 이름이 비어 있음`);
    if (seen.has(bundleId)) throw new Error(`${where}: 실행 묶음 id가 중복됨`);
    seen.add(bundleId);

    if (!Array.isArray(targets) || targets.length === 0) {
      throw new Error(`${where}: 대상을 1개 이상 골라야 함`);
    }
    const bundleTargets = targets.map((target) => String(target ?? '').trim());
    if (bundleTargets.some((target) => !target)) {
      throw new Error(`${where}: 빈 대상이 들어 있음`);
    }
    if (new Set(bundleTargets).size !== bundleTargets.length) {
      throw new Error(`${where}: 같은 대상이 여러 번 들어 있음`);
    }
    // 프리셋에 없는 대상을 묶어두면 눌렀을 때 서버가 거절한다. 저장 때 막는다.
    const unknown = bundleTargets.filter((target) => !targetIds.has(target));
    if (unknown.length > 0) {
      throw new Error(`${where}: 이 계정에 없는 대상임 (${unknown.join(', ')})`);
    }

    const bundle: RunBundle = {
      id: bundleId,
      label: bundleLabel,
      targets: bundleTargets,
    };
    if (maxPages !== undefined && maxPages !== null) {
      if (
        typeof maxPages !== 'number' ||
        !Number.isInteger(maxPages) ||
        maxPages < 1 ||
        maxPages > MAX_PAGE_DEPTH - 1
      ) {
        throw new Error(`${where}: 페이지 수는 1~${MAX_PAGE_DEPTH - 1} 사이여야 함`);
      }
      bundle.maxPages = maxPages;
    }
    return bundle;
  });
};

export const parsePreset = (raw: unknown): TenantPreset => {
  const { targets, blogGroups, runBundles, doorayWebhookUrl } = asRecord(raw);
  if (!Array.isArray(targets)) {
    throw new Error('대상 목록이 배열이 아님');
  }

  const parsedGroups = parseBlogGroups(blogGroups);
  const parsedTargets = targets.map((target, index) =>
    parseTarget(target, index, parsedGroups),
  );
  const seen = new Set<string>();
  parsedTargets.forEach(({ id, label }) => {
    if (seen.has(id)) throw new Error(`${label}: 대상 id "${id}"가 중복됨`);
    seen.add(id);
  });

  const preset: TenantPreset = {
    targets: parsedTargets,
    blogGroups: parsedGroups,
  };
  const parsedBundles = parseRunBundles(
    runBundles,
    new Set(parsedTargets.map(({ id }) => id)),
  );
  if (parsedBundles.length > 0) preset.runBundles = parsedBundles;
  const parsedWebhook = parseDoorayWebhookUrl(doorayWebhookUrl);
  if (parsedWebhook) preset.doorayWebhookUrl = parsedWebhook;

  return preset;
};
