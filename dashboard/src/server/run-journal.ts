import fs from 'node:fs';
import path from 'node:path';
import type { RunRecord, RunStatus, RunSummary } from './run-record';
import { DASHBOARD_RUN_STATE_PATH } from './paths';

export interface PersistedRun extends RunSummary {
  processId: number;
  processIdentity: string | null;
  logPath: string;
}

const RUN_STATUSES = new Set<RunStatus>([
  'running',
  'success',
  'failed',
  'stopped',
  'unknown',
]);

const isPersistedRun = (value: unknown): value is PersistedRun => {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<PersistedRun>;
  return typeof run.runId === 'string'
    && typeof run.jobId === 'string'
    && typeof run.jobLabel === 'string'
    && typeof run.status === 'string'
    && RUN_STATUSES.has(run.status as RunStatus)
    && typeof run.startedAt === 'number'
    && (run.endedAt === null || typeof run.endedAt === 'number')
    && (run.exitCode === null || typeof run.exitCode === 'number')
    && typeof run.processId === 'number'
    && (run.processIdentity === null || typeof run.processIdentity === 'string')
    && typeof run.logPath === 'string';
};

export const toPersistedRun = (run: RunRecord): PersistedRun => ({
  runId: run.runId,
  jobId: run.jobId,
  jobLabel: run.jobLabel,
  status: run.status,
  startedAt: run.startedAt,
  endedAt: run.endedAt,
  exitCode: run.exitCode,
  processId: run.processId,
  processIdentity: run.processIdentity,
  logPath: run.logPath,
});

export const loadRunJournal = (statePath = DASHBOARD_RUN_STATE_PATH): PersistedRun[] => {
  try {
    const value = JSON.parse(fs.readFileSync(statePath, 'utf8')) as unknown;
    return Array.isArray(value) ? value.filter(isPersistedRun) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('실행 기록을 불러오지 못함', error);
    return [];
  }
};

export const saveRunJournal = (
  runs: Iterable<RunRecord>,
  statePath = DASHBOARD_RUN_STATE_PATH,
) => {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tempPath = `${statePath}.${process.pid}.tmp`;
  const serialized = JSON.stringify(Array.from(runs, toPersistedRun), null, 2);
  try {
    fs.writeFileSync(tempPath, serialized, 'utf8');
    fs.renameSync(tempPath, statePath);
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
};

export const readRunLogLines = (logPath: string, maxLines = 2000): string[] => {
  try {
    const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    return lines.slice(-maxLines);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};
