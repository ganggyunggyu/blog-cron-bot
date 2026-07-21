export type RunStatus = 'running' | 'success' | 'failed' | 'stopped' | 'unknown';

export interface RunSummary {
  runId: string;
  jobId: string;
  jobLabel: string;
  status: RunStatus;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
}

export interface RunSnapshot extends RunSummary {
  logLines: string[];
}

export type RunOutputStream = 'stdout' | 'stderr';

export interface RunRecord extends RunSummary {
  processId: number;
  processIdentity: string | null;
  logPath: string;
  logLines: string[];
  pendingText: Record<RunOutputStream, string>;
  logListeners: Set<(line: string) => void>;
  doneListeners: Set<() => void>;
  releaseResource: () => void;
}

const MAX_BUFFERED_LINES = 2000;

export const toRunSummary = (run: RunRecord): RunSummary => ({
  runId: run.runId,
  jobId: run.jobId,
  jobLabel: run.jobLabel,
  status: run.status,
  startedAt: run.startedAt,
  endedAt: run.endedAt,
  exitCode: run.exitCode,
});

export const appendRunLine = (run: RunRecord, line: string) => {
  run.logLines.push(line);
  if (run.logLines.length > MAX_BUFFERED_LINES) run.logLines.shift();
  run.logListeners.forEach((listener) => listener(line));
};

export const appendRunChunk = (run: RunRecord, stream: RunOutputStream, chunk: Buffer) => {
  run.pendingText[stream] += chunk.toString();
  const parts = run.pendingText[stream].split('\n');
  run.pendingText[stream] = parts.pop() ?? '';
  parts.forEach((line) => appendRunLine(run, line));
};

export const flushRunPendingText = (run: RunRecord) => {
  (['stdout', 'stderr'] as const).forEach((stream) => {
    if (!run.pendingText[stream]) return;
    appendRunLine(run, run.pendingText[stream]);
    run.pendingText[stream] = '';
  });
};
