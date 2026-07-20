export type LogLineKind = 'success' | 'failure' | 'search' | 'detail' | 'plain';

export interface ParsedLogLine {
  raw: string;
  kind: LogLineKind;
  progress: { current: number; total: number } | null;
  targetProgress: TargetProgress | null;
}

export type TargetProgressStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TargetProgress {
  target: string;
  current: number;
  total: number;
  status: TargetProgressStatus;
}

const PROGRESS_PATTERN = /\[\s*(\d+)\/(\d+)\]/;
const TIMESTAMP_PATTERN = /^\d{2}:\d{2}:\d{2}\s/;
const INDENTED_DETAIL_PATTERN = /^\s{4,}\S/;
const TARGET_PROGRESS_MARKER = '@@EXPOSURE_PROGRESS';
const TARGET_PROGRESS_STATUSES = new Set<TargetProgressStatus>([
  'pending',
  'running',
  'success',
  'failed',
]);

const parseTargetProgress = (line: string): TargetProgress | null => {
  const markerIndex = line.indexOf(TARGET_PROGRESS_MARKER);
  if (markerIndex < 0) return null;

  const payload = line.slice(markerIndex + TARGET_PROGRESS_MARKER.length);
  const start = payload.indexOf('{');
  const end = payload.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const value = JSON.parse(payload.slice(start, end + 1)) as Partial<TargetProgress>;
    if (
      typeof value.target !== 'string' ||
      typeof value.current !== 'number' ||
      typeof value.total !== 'number' ||
      typeof value.status !== 'string' ||
      !TARGET_PROGRESS_STATUSES.has(value.status as TargetProgressStatus)
    ) {
      return null;
    }

    return {
      target: value.target,
      current: Math.max(0, Math.floor(value.current)),
      total: Math.max(0, Math.floor(value.total)),
      status: value.status as TargetProgressStatus,
    };
  } catch {
    return null;
  }
};

export const parseLogLine = (line: string): ParsedLogLine => {
  const targetProgress = parseTargetProgress(line);
  if (targetProgress) {
    return { raw: line, kind: 'detail', progress: null, targetProgress };
  }

  const progressMatch = line.match(PROGRESS_PATTERN);
  const progress = progressMatch
    ? { current: Number(progressMatch[1]), total: Number(progressMatch[2]) }
    : null;

  if (progressMatch) {
    if (line.includes('✖')) return { raw: line, kind: 'failure', progress, targetProgress: null };
    if (line.includes('○')) return { raw: line, kind: 'detail', progress, targetProgress: null };
    if (line.includes('✓')) return { raw: line, kind: 'success', progress, targetProgress: null };
  }

  if (TIMESTAMP_PATTERN.test(line)) {
    return { raw: line, kind: 'search', progress, targetProgress: null };
  }

  if (INDENTED_DETAIL_PATTERN.test(line)) {
    return { raw: line, kind: 'detail', progress, targetProgress: null };
  }

  return { raw: line, kind: 'plain', progress, targetProgress: null };
};

export const findLatestProgress = (
  lines: ParsedLogLine[],
): { current: number; total: number } | null => {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].progress) return lines[i].progress;
  }
  return null;
};

export const findTargetProgress = (lines: ParsedLogLine[]): TargetProgress[] => {
  const latestByTarget = new Map<string, TargetProgress>();

  lines.forEach(({ targetProgress }) => {
    if (!targetProgress) return;
    const previous = latestByTarget.get(targetProgress.target);
    const total = targetProgress.total > 0
      ? targetProgress.total
      : previous?.total ?? 0;
    const current = targetProgress.total > 0
      ? targetProgress.current
      : targetProgress.status === 'success' && total > 0
        ? total
        : previous?.current ?? 0;

    latestByTarget.set(targetProgress.target, {
      ...targetProgress,
      current,
      total,
    });
  });

  return Array.from(latestByTarget.values());
};
