import { toRunSummary, type RunRecord, type RunSnapshot, type RunSummary } from './run-record';

export const getRunSnapshotFrom = (
  runs: ReadonlyMap<string, RunRecord>,
  runId: string,
): RunSnapshot | null => {
  const run = runs.get(runId);
  return run ? { ...toRunSummary(run), logLines: [...run.logLines] } : null;
};

export const listRunSummariesFrom = (runs: ReadonlyMap<string, RunRecord>): RunSummary[] =>
  Array.from(runs.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(toRunSummary);

export const subscribeToRun = (
  runs: ReadonlyMap<string, RunRecord>,
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
