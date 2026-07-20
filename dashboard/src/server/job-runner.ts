import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { buildJobSpawnArgs } from './job-command';
import { InvalidJobInputError, JobConflictError } from './job-errors';
import { getJobDefinition } from './job-registry';
import { isJobResourceBlocked, reserveJobResource } from './job-resource-manager';
import { REPO_ENV_PATH, REPO_ROOT } from './paths';
import {
  appendRunChunk,
  appendRunLine,
  flushRunPendingText,
  toRunSummary,
  type RunRecord,
  type RunSnapshot,
  type RunStatus,
  type RunSummary,
} from './run-record';

export type { RunSnapshot, RunStatus, RunSummary } from './run-record';

const MAX_TRACKED_RUNS = 50;
const runs = new Map<string, RunRecord>();
const childProcesses = new Map<string, ChildProcess>();
const activeJobIds = new Set<string>();

const loadRepoEnv = (): Record<string, string> => {
  const result = dotenv.config({ path: REPO_ENV_PATH, processEnv: {} });
  return result.parsed ?? {};
};

const pruneOldRuns = () => {
  if (runs.size <= MAX_TRACKED_RUNS) return;
  const sorted = Array.from(runs.values()).sort((a, b) => a.startedAt - b.startedAt);
  const overflow = sorted.length - MAX_TRACKED_RUNS;
  for (let i = 0; i < overflow; i += 1) {
    if (sorted[i].status !== 'running') runs.delete(sorted[i].runId);
  }
};

const releaseRunResource = (run: RunRecord) => {
  try {
    run.releaseResource();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendRunLine(run, `[잠금 해제 오류] ${message}`);
  }
  run.releaseResource = () => undefined;
};

const terminateChildProcess = (child: ChildProcess) => {
  if (child.pid === undefined) {
    child.kill('SIGTERM');
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    if (!child.kill('SIGTERM')) throw new Error('자식 프로세스를 종료하지 못함');
  }
};

const finishRun = (run: RunRecord, status: RunStatus, exitCode: number | null) => {
  if (run.endedAt !== null) return;
  flushRunPendingText(run);
  run.status = status;
  run.exitCode = exitCode;
  run.endedAt = Date.now();
  childProcesses.delete(run.runId);
  activeJobIds.delete(run.jobId);
  releaseRunResource(run);
  run.doneListeners.forEach((listener) => listener());
  run.doneListeners.clear();
  pruneOldRuns();
};

export const isJobActive = (jobId: string) => activeJobIds.has(jobId);

export const isJobBlocked = (jobId: string): boolean => {
  const job = getJobDefinition(jobId);
  if (!job) return false;
  return isJobResourceBlocked(job, isJobActive(jobId));
};

export const startJob = (jobId: string, input?: unknown): RunSummary => {
  const job = getJobDefinition(jobId);
  if (!job) throw new InvalidJobInputError(`알 수 없는 잡: ${jobId}`);

  const spawnArgs = buildJobSpawnArgs(job, input);
  if (activeJobIds.has(jobId)) throw new JobConflictError('이미 실행 중인 잡임');

  const repoEnv = loadRepoEnv();
  const runId = randomUUID();
  const resource = reserveJobResource(job, runId);
  let child: ChildProcess;
  try {
    child = spawn('pnpm', spawnArgs, {
      cwd: REPO_ROOT,
      detached: true,
      env: { ...process.env, ...repoEnv },
    });
  } catch (error) {
    resource.release();
    throw error;
  }

  try {
    if (child.pid === undefined) {
      child.once('error', (spawnError) => {
        console.error('PID가 없는 자식 프로세스 오류', spawnError);
      });
      throw new Error('자식 프로세스 PID를 확인할 수 없음');
    }
    resource.attachChildPid(child.pid);
  } catch (error) {
    let terminationError: unknown;
    try {
      terminateChildProcess(child);
    } catch (caughtTerminationError) {
      terminationError = caughtTerminationError;
    } finally {
      resource.release();
    }
    if (terminationError) {
      throw new Error('실행 준비 실패 후 자식 프로세스를 종료하지 못함', {
        cause: terminationError,
      });
    }
    throw error;
  }

  const run: RunRecord = {
    runId,
    jobId,
    jobLabel: job.label,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    logLines: [],
    pendingText: { stdout: '', stderr: '' },
    logListeners: new Set(),
    doneListeners: new Set(),
    releaseResource: resource.release,
  };

  runs.set(runId, run);
  childProcesses.set(runId, child);
  activeJobIds.add(jobId);
  child.stdout?.on('data', (chunk: Buffer) => appendRunChunk(run, 'stdout', chunk));
  child.stderr?.on('data', (chunk: Buffer) => appendRunChunk(run, 'stderr', chunk));
  child.on('close', (code) => {
    const status: RunStatus =
      run.status === 'stopped' ? 'stopped' : code === 0 ? 'success' : 'failed';
    finishRun(run, status, code);
  });
  child.on('error', (error) => {
    appendRunLine(run, `[프로세스 오류] ${error.message}`);
    finishRun(run, run.status === 'stopped' ? 'stopped' : 'failed', null);
  });

  return toRunSummary(run);
};

export const stopRun = (runId: string) => {
  const child = childProcesses.get(runId);
  const run = runs.get(runId);
  if (!run) throw new Error('실행 기록을 찾을 수 없음');
  if (!child || child.pid === undefined) throw new Error('이미 종료된 실행임');

  run.status = 'stopped';
  try {
    terminateChildProcess(child);
  } catch (error) {
    run.status = 'running';
    throw error;
  }
};

export const getRunSnapshot = (runId: string): RunSnapshot | null => {
  const run = runs.get(runId);
  return run ? { ...toRunSummary(run), logLines: [...run.logLines] } : null;
};

export const listRuns = (): RunSummary[] =>
  Array.from(runs.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(toRunSummary);

export const subscribeToRunLogs = (
  runId: string,
  onLine: (line: string) => void,
  onDone: () => void,
): (() => void) | null => {
  const run = runs.get(runId);
  if (!run) return null;
  if (run.status !== 'running') {
    onDone();
    return () => undefined;
  }

  run.logListeners.add(onLine);
  run.doneListeners.add(onDone);
  return () => {
    run.logListeners.delete(onLine);
    run.doneListeners.delete(onDone);
  };
};
