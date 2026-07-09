import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { getJobDefinition } from './job-registry';
import { REPO_ENV_PATH, REPO_ROOT } from './paths';

export type RunStatus = 'running' | 'success' | 'failed' | 'stopped';

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

interface RunRecord extends RunSummary {
  logLines: string[];
  pendingText: string;
  logListeners: Set<(line: string) => void>;
  doneListeners: Set<() => void>;
}

const MAX_BUFFERED_LINES = 2000;
const MAX_TRACKED_RUNS = 50;

const runs = new Map<string, RunRecord>();
const childProcesses = new Map<string, ChildProcess>();
const activeJobIds = new Set<string>();

const loadRepoEnv = (): Record<string, string> => {
  const result = dotenv.config({ path: REPO_ENV_PATH, processEnv: {} });
  return result.parsed ?? {};
};

const toSummary = (run: RunRecord): RunSummary => ({
  runId: run.runId,
  jobId: run.jobId,
  jobLabel: run.jobLabel,
  status: run.status,
  startedAt: run.startedAt,
  endedAt: run.endedAt,
  exitCode: run.exitCode,
});

const appendLine = (run: RunRecord, line: string) => {
  run.logLines.push(line);
  if (run.logLines.length > MAX_BUFFERED_LINES) {
    run.logLines.shift();
  }
  run.logListeners.forEach((listener) => listener(line));
};

const appendChunk = (run: RunRecord, chunk: Buffer) => {
  run.pendingText += chunk.toString();
  const parts = run.pendingText.split('\n');
  run.pendingText = parts.pop() ?? '';
  parts.forEach((line) => appendLine(run, line));
};

const pruneOldRuns = () => {
  if (runs.size <= MAX_TRACKED_RUNS) return;
  const sorted = Array.from(runs.values()).sort((a, b) => a.startedAt - b.startedAt);
  const overflow = sorted.length - MAX_TRACKED_RUNS;
  for (let i = 0; i < overflow; i += 1) {
    if (sorted[i].status === 'running') continue;
    runs.delete(sorted[i].runId);
  }
};

const finishRun = (run: RunRecord, status: RunStatus, exitCode: number | null) => {
  if (run.pendingText) {
    appendLine(run, run.pendingText);
    run.pendingText = '';
  }
  run.status = status;
  run.exitCode = exitCode;
  run.endedAt = Date.now();
  childProcesses.delete(run.runId);
  activeJobIds.delete(run.jobId);
  run.doneListeners.forEach((listener) => listener());
  run.doneListeners.clear();
  pruneOldRuns();
};

export const isJobActive = (jobId: string) => activeJobIds.has(jobId);

export const startJob = (jobId: string): RunSummary => {
  const job = getJobDefinition(jobId);
  if (!job) {
    throw new Error(`알 수 없는 잡: ${jobId}`);
  }
  if (activeJobIds.has(jobId)) {
    throw new Error('이미 실행 중인 잡임');
  }

  const repoEnv = loadRepoEnv();
  const runId = randomUUID();

  const child = spawn('pnpm', ['run', job.script], {
    cwd: REPO_ROOT,
    detached: true,
    env: { ...process.env, ...repoEnv },
  });

  const run: RunRecord = {
    runId,
    jobId,
    jobLabel: job.label,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    logLines: [],
    pendingText: '',
    logListeners: new Set(),
    doneListeners: new Set(),
  };

  runs.set(runId, run);
  childProcesses.set(runId, child);
  activeJobIds.add(jobId);

  child.stdout?.on('data', (chunk: Buffer) => appendChunk(run, chunk));
  child.stderr?.on('data', (chunk: Buffer) => appendChunk(run, chunk));

  child.on('close', (code) => {
    const finalStatus: RunStatus =
      run.status === 'stopped' ? 'stopped' : code === 0 ? 'success' : 'failed';
    finishRun(run, finalStatus, code);
  });

  child.on('error', (err) => {
    appendLine(run, `[프로세스 오류] ${err.message}`);
  });

  return toSummary(run);
};

export const stopRun = (runId: string) => {
  const child = childProcesses.get(runId);
  const run = runs.get(runId);
  if (!run) {
    throw new Error('실행 기록을 찾을 수 없음');
  }
  if (!child || child.pid === undefined) {
    throw new Error('이미 종료된 실행임');
  }

  run.status = 'stopped';
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
};

export const getRunSnapshot = (runId: string): RunSnapshot | null => {
  const run = runs.get(runId);
  if (!run) return null;
  return { ...toSummary(run), logLines: [...run.logLines] };
};

export const listRuns = (): RunSummary[] =>
  Array.from(runs.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(toSummary);

export const subscribeToRunLogs = (
  runId: string,
  onLine: (line: string) => void,
  onDone: () => void,
): (() => void) | null => {
  const run = runs.get(runId);
  if (!run) return null;

  if (run.status !== 'running') {
    onDone();
    return () => {};
  }

  run.logListeners.add(onLine);
  run.doneListeners.add(onDone);
  return () => {
    run.logListeners.delete(onLine);
    run.doneListeners.delete(onDone);
  };
};
