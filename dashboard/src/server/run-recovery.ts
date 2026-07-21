import { isSameProcess } from './process-control';
import { loadRunJournal, readRunLogLines } from './run-journal';
import { appendRunLine, type RunRecord } from './run-record';

export const restoreRunRecords = (): RunRecord[] =>
  loadRunJournal().map((persisted) => {
    const isStillRunning = persisted.status === 'running'
      && isSameProcess(persisted.processId, persisted.processIdentity);
    const run: RunRecord = {
      ...persisted,
      status: persisted.status === 'running' && !isStillRunning ? 'unknown' : persisted.status,
      endedAt: persisted.status === 'running' && !isStillRunning ? Date.now() : persisted.endedAt,
      logLines: readRunLogLines(persisted.logPath),
      pendingText: { stdout: '', stderr: '' },
      logListeners: new Set(),
      doneListeners: new Set(),
      releaseResource: () => undefined,
    };

    if (persisted.status === 'running' && !isStillRunning) {
      appendRunLine(run, '[복구] 대시보드 재시작 후 종료 코드를 확인할 수 없음');
    }
    return run;
  });
