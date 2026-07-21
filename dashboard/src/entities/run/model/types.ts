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
