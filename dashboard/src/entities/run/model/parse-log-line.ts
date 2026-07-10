export type LogLineKind = 'success' | 'failure' | 'search' | 'detail' | 'plain';

export interface ParsedLogLine {
  raw: string;
  kind: LogLineKind;
  progress: { current: number; total: number } | null;
}

const PROGRESS_PATTERN = /\[\s*(\d+)\/(\d+)\]/;
const TIMESTAMP_PATTERN = /^\d{2}:\d{2}:\d{2}\s/;
const INDENTED_DETAIL_PATTERN = /^\s{4,}\S/;

export const parseLogLine = (line: string): ParsedLogLine => {
  const progressMatch = line.match(PROGRESS_PATTERN);
  const progress = progressMatch
    ? { current: Number(progressMatch[1]), total: Number(progressMatch[2]) }
    : null;

  if (progressMatch) {
    if (line.includes('✖')) return { raw: line, kind: 'failure', progress };
    if (line.includes('○')) return { raw: line, kind: 'detail', progress };
    if (line.includes('✓')) return { raw: line, kind: 'success', progress };
  }

  if (TIMESTAMP_PATTERN.test(line)) {
    return { raw: line, kind: 'search', progress };
  }

  if (INDENTED_DETAIL_PATTERN.test(line)) {
    return { raw: line, kind: 'detail', progress };
  }

  return { raw: line, kind: 'plain', progress };
};

export const findLatestProgress = (
  lines: ParsedLogLine[],
): { current: number; total: number } | null => {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].progress) return lines[i].progress;
  }
  return null;
};
