export const CHECK_KINDS = ['basic', 'more', 'page'] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export const CHECK_KIND_LABELS: Record<CheckKind, string> = {
  basic: '기본 노출체크',
  more: '더보기 노출체크',
  page: '페이지 노출체크',
};

export const CHECK_KIND_SHORT_LABELS: Record<CheckKind, string> = {
  basic: '기본',
  more: '더보기',
  page: '페이지',
};

export interface SheetLocation {
  sheetId: string;
  tabTitle: string;
}

/** 이름 붙인 계정 묶음. 준최, 최블, 도그마루처럼 만들어두고 대상이 골라 쓴다. */
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
  blogGroupIds?: string[];
  blogIds?: string[];
  enabled: boolean;
}

/** 자주 쓰는 대상 조합에 이름을 붙여둔 것. 버튼 하나로 돌린다. */
export interface RunBundle {
  id: string;
  label: string;
  targets: string[];
  maxPages?: number;
}

/** 직접 만든 카페 노출체크. 시트와 볼 카페를 정하면 실행 화면에 줄이 생긴다. */
export interface CafeCheck {
  id: string;
  label: string;
  sheetUrl: string;
  tabTitle: string;
  cafeNames: string[];
}

export interface TenantPreset {
  targets: PresetTarget[];
  blogGroups: BlogGroup[];
  runBundles?: RunBundle[];
  cafeChecks?: CafeCheck[];
  doorayWebhookUrl?: string;
}

/** 대상이 실제로 볼 계정. 고른 그룹을 순서대로 합치고 직접 계정을 뒤에 붙인다. */
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

export interface PresetOwner {
  id: string;
  loginId: string;
  displayName: string;
}

export interface PresetResponse {
  member: PresetOwner;
  preset: TenantPreset;
}
