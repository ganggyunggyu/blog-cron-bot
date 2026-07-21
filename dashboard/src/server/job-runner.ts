import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { buildJobSpawnArgs } from './job-command';
import { InvalidJobInputError, JobConflictError } from './job-errors';
import { spawnJobProcess } from './job-process';
import { getJobDefinition } from './job-registry';
import { isJobResourceBlocked, reserveJobResource } from './job-resource-manager';
import { DASHBOARD_RUN_LOG_DIR } from './paths';
import { getProcessIdentity, isSameProcess, terminateProcessGroup } from './process-control';
import { saveRunJournal } from './run-journal';
import { createRunLogTail, type RunLogTail } from './run-log-tail';
import { restoreRunRecords } from './run-recovery';
import { getRunSnapshotFrom, listRunSummariesFrom, subscribeToRun } from './run-query';
import { attachRunProcessListeners, createStartedRun } from './started-run';
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
const RECOVERED_RUN_POLL_MS = 2000;
const runs = new Map<string, RunRecord>();
const childProcesses = new Map<string, ChildProcess>();
const activeJobIds = new Set<string>();
const logTails = new Map<string, RunLogTail>();

const persistRuns = () => {
  try {
    saveRunJournal(runs.values());
  } catch (error) {
    console.error('실행 기록을 저장하지 못함', error);
  }
};

const pruneOldRuns = () => {
  if (runs.size <= MAX_TRACKED_RUNS) return;
  const finishedRuns = Array.from(runs.values())
    .filter(({ status }) => status !== 'running')
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const run of finishedRuns) {
    if (runs.size <= MAX_TRACKED_RUNS) break;
    runs.delete(run.runId);
  }
};

const startLogTail = (run: RunRecord) => {
  logTails.get(run.runId)?.close();
  const tail = createRunLogTail(run.logPath, (chunk) => {
    appendRunChunk(run, 'stdout', chunk);
  });
  logTails.set(run.runId, tail);
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

const finishRun = (run: RunRecord, status: RunStatus, exitCode: number | null) => {
  if (run.endedAt !== null) return;
  logTails.get(run.runId)?.close();
  logTails.delete(run.runId);
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
  persistRuns();
};

const recoverPersistedRuns = () => {
  const restoredRuns = restoreRunRecords();
  if (restoredRuns.length === 0) return;
  restoredRuns.forEach((run) => {
    runs.set(run.runId, run);
    if (run.status !== 'running') return;
    activeJobIds.add(run.jobId);
    startLogTail(run);
  });
  pruneOldRuns();
  persistRuns();
};

const monitorRecoveredRuns = () => {
  runs.forEach((run) => {
    if (run.status !== 'running' || childProcesses.has(run.runId)) return;
    if (isSameProcess(run.processId, run.processIdentity)) return;
    appendRunLine(run, '[복구] 실행이 종료됐지만 종료 코드는 확인할 수 없음');
    finishRun(run, 'unknown', null);
  });
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
  const runId = randomUUID();
  const logPath = path.join(DASHBOARD_RUN_LOG_DIR, `${runId}.log`);
  const resource = reserveJobResource(job, runId);
  let child: ChildProcess;
  try {
    child = spawnJobProcess(spawnArgs, logPath);
  } catch (error) {
    resource.release();
    throw error;
  }

  try {
    if (child.pid === undefined) throw new Error('자식 프로세스 PID를 확인할 수 없음');
    resource.attachChildPid(child.pid);
  } catch (error) {
    if (child.pid !== undefined) terminateProcessGroup(child.pid);
    resource.release();
    throw error;
  }

  const run = createStartedRun({
    runId,
    jobId,
    jobLabel: job.label,
    processId: child.pid,
    processIdentity: getProcessIdentity(child.pid),
    logPath,
    releaseResource: resource.release,
  });

  runs.set(runId, run);
  childProcesses.set(runId, child);
  activeJobIds.add(jobId);
  startLogTail(run);
  persistRuns();

  attachRunProcessListeners(child, run, finishRun);

  return toRunSummary(run);
};

export const stopRun = (runId: string) => {
  const run = runs.get(runId);
  if (!run) throw new Error('실행 기록을 찾을 수 없음');
  if (run.status !== 'running') throw new Error('이미 종료된 실행임');
  if (!childProcesses.has(runId) && !isSameProcess(run.processId, run.processIdentity)) {
    finishRun(run, 'unknown', null);
    throw new Error('복구된 실행 프로세스가 더 이상 동일하지 않음');
  }

  run.status = 'stopped';
  persistRuns();
  try {
    terminateProcessGroup(run.processId);
  } catch (error) {
    run.status = 'running';
    persistRuns();
    throw error;
  }

  if (!childProcesses.has(runId)) finishRun(run, 'stopped', null);
};

export const getRunSnapshot = (runId: string): RunSnapshot | null =>
  getRunSnapshotFrom(runs, runId);

export const listRuns = (): RunSummary[] => listRunSummariesFrom(runs);
export const subscribeToRunLogs = (
  runId: string,
  onLine: (line: string) => void,
  onDone: () => void,
): (() => void) | null => subscribeToRun(runs, runId, onLine, onDone);

recoverPersistedRuns();
const recoveredRunMonitor = setInterval(monitorRecoveredRuns, RECOVERED_RUN_POLL_MS);
recoveredRunMonitor.unref();
