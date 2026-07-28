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

export interface PresetTarget {
  id: string;
  label: string;
  kind: CheckKind;
  source: SheetLocation;
  result?: SheetLocation;
  maxPages?: number;
  blogIds?: string[];
  enabled: boolean;
}

export interface TenantPreset {
  targets: PresetTarget[];
  doorayWebhookUrl?: string;
}

export interface PresetOwner {
  id: string;
  loginId: string;
  displayName: string;
}

export interface PresetResponse {
  member: PresetOwner;
  preset: TenantPreset;
}
