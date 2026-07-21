import type { ChildProcess } from 'node:child_process';
import { appendRunLine, type RunRecord, type RunStatus } from './run-record';

interface CreateStartedRunInput {
  runId: string;
  jobId: string;
  jobLabel: string;
  processId: number;
  processIdentity: string | null;
  logPath: string;
  releaseResource: () => void;
}

export const createStartedRun = ({
  runId,
  jobId,
  jobLabel,
  processId,
  processIdentity,
  logPath,
  releaseResource,
}: CreateStartedRunInput): RunRecord => ({
  runId,
  jobId,
  jobLabel,
  status: 'running',
  startedAt: Date.now(),
  endedAt: null,
  exitCode: null,
  processId,
  processIdentity,
  logPath,
  logLines: [],
  pendingText: { stdout: '', stderr: '' },
  logListeners: new Set(),
  doneListeners: new Set(),
  releaseResource,
});

export const attachRunProcessListeners = (
  child: ChildProcess,
  run: RunRecord,
  finishRun: (run: RunRecord, status: RunStatus, exitCode: number | null) => void,
) => {
  child.on('close', (code) => {
    const status: RunStatus = run.status === 'stopped'
      ? 'stopped'
      : code === 0
        ? 'success'
        : 'failed';
    finishRun(run, status, code);
  });
  child.on('error', (error) => {
    appendRunLine(run, `[프로세스 오류] ${error.message}`);
    finishRun(run, run.status === 'stopped' ? 'stopped' : 'failed', null);
  });
};
