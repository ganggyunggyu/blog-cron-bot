import {
  findLatestProgress,
  findTargetProgress,
  parseLogLine,
  type ParsedLogLine,
} from '@/entities/run';

export interface RunLogViewModel {
  parsedLines: ParsedLogLine[];
  visibleLines: ParsedLogLine[];
  latestProgress: { current: number; total: number } | null;
  targetProgress: ReturnType<typeof findTargetProgress>;
  successCount: number;
  failureCount: number;
}

export const buildRunLogViewModel = (lines: string[], showDetail: boolean): RunLogViewModel => {
  const parsedLines = lines.map(parseLogLine);
  let successCount = 0;
  let failureCount = 0;

  parsedLines.forEach(({ kind }) => {
    if (kind === 'success') successCount += 1;
    if (kind === 'failure') failureCount += 1;
  });

  return {
    parsedLines,
    visibleLines: showDetail
      ? parsedLines
      : parsedLines.filter(({ kind }) => kind !== 'detail'),
    latestProgress: findLatestProgress(parsedLines),
    targetProgress: findTargetProgress(parsedLines),
    successCount,
    failureCount,
  };
};
