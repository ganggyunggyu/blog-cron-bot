export const ALL_MORE_TARGETS = [
  'package',
  'general',
  'dogmaru',
  'root',
] as const;

/** 인자를 안 주면 예전처럼 세 시트를 묶어서 돈다. */
export const DEFAULT_MORE_TARGETS = ['package', 'general', 'dogmaru'] as const;

export type MoreTarget = (typeof ALL_MORE_TARGETS)[number];

export const MORE_TARGET_LABELS: Record<MoreTarget, string> = {
  package: '패키지',
  general: '일반건',
  dogmaru: '도그마루',
  root: '루트',
};

/**
 * `--targets=root`처럼 더보기 대상을 골라 받는다.
 *
 * 루트 더보기는 단일 프로세스로 돌아 708개 키워드에 5시간이 걸렸다. 같은 분산 경로에
 * 태우되 세 시트 묶음과 루트를 따로 돌릴 수 있어야 해서 인자로 나눈다.
 * 오타를 조용히 무시하면 아무것도 안 돌고 성공으로 끝나므로 모르는 이름은 막는다.
 */
export const parseMoreTargets = (argv: readonly string[]): MoreTarget[] => {
  const raw = argv
    .find((arg) => arg.startsWith('--targets='))
    ?.slice('--targets='.length)
    .trim();
  if (!raw) return [...DEFAULT_MORE_TARGETS];

  const requested = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (requested.length === 0) return [...DEFAULT_MORE_TARGETS];

  const unknown = requested.filter(
    (value) => !(ALL_MORE_TARGETS as readonly string[]).includes(value)
  );
  if (unknown.length > 0) {
    throw new Error(`더보기 대상이 아님: ${unknown.join(', ')}`);
  }

  return Array.from(new Set(requested)) as MoreTarget[];
};
