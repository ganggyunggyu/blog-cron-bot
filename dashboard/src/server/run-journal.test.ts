import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadRunJournal, readRunLogLines, saveRunJournal } from './run-journal';
import type { RunRecord } from './run-record';

const createRun = (directory: string): RunRecord => ({
  runId: 'run-1',
  jobId: 'job-1',
  jobLabel: '테스트 잡',
  status: 'running',
  startedAt: 10,
  endedAt: null,
  exitCode: null,
  processId: 123,
  processIdentity: 'boot:start',
  logPath: path.join(directory, 'run-1.log'),
  logLines: ['메모리 로그'],
  pendingText: { stdout: '', stderr: '' },
  logListeners: new Set(),
  doneListeners: new Set(),
  releaseResource: () => undefined,
});

test('실행 메타데이터를 원자 저장하고 다시 읽음', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-run-journal-'));
  const statePath = path.join(directory, 'runs.json');
  const run = createRun(directory);

  saveRunJournal([run], statePath);

  assert.deepEqual(loadRunJournal(statePath), [{
    runId: 'run-1',
    jobId: 'job-1',
    jobLabel: '테스트 잡',
    status: 'running',
    startedAt: 10,
    endedAt: null,
    exitCode: null,
    processId: 123,
    processIdentity: 'boot:start',
    logPath: run.logPath,
  }]);
});

test('로그 파일에서 최신 행만 복구함', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-run-log-'));
  const logPath = path.join(directory, 'run.log');
  fs.writeFileSync(logPath, 'one\ntwo\nthree\n', 'utf8');

  assert.deepEqual(readRunLogLines(logPath, 2), ['two', 'three']);
});
