import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendRunChunk,
  flushRunPendingText,
  type RunRecord,
} from './run-record';

const createRun = (): RunRecord => ({
  runId: 'run-1',
  jobId: 'job-1',
  jobLabel: '테스트 잡',
  status: 'running',
  startedAt: 1,
  endedAt: null,
  exitCode: null,
  processId: 101,
  processIdentity: null,
  logPath: '/tmp/run-1.log',
  logLines: [],
  pendingText: { stdout: '', stderr: '' },
  logListeners: new Set(),
  doneListeners: new Set(),
  releaseResource: () => undefined,
});

test('stdout과 stderr의 부분 청크를 서로 다른 버퍼에 보관함', () => {
  const run = createRun();

  appendRunChunk(run, 'stdout', Buffer.from('stdout-part'));
  appendRunChunk(run, 'stderr', Buffer.from('stderr-line\n'));
  appendRunChunk(run, 'stdout', Buffer.from('-done\n'));
  appendRunChunk(run, 'stderr', Buffer.from('stderr-tail'));
  flushRunPendingText(run);

  assert.deepEqual(run.logLines, ['stderr-line', 'stdout-part-done', 'stderr-tail']);
  assert.deepEqual(run.pendingText, { stdout: '', stderr: '' });
});
