import assert from 'node:assert/strict';
import test from 'node:test';
import { findTargetProgress, parseLogLine } from './parse-log-line';

test('parses structured target progress without confusing step logs', () => {
  const step = parseLogLine('  ▶ [1/3] 동기화');
  const progress = parseLogLine(
    '19:00:00 │ → │ @@EXPOSURE_PROGRESS {"target":"pet","current":25,"total":100,"status":"running"}'
  );

  assert.deepEqual(step.progress, { current: 1, total: 3 });
  assert.equal(step.targetProgress, null);
  assert.deepEqual(progress.targetProgress, {
    target: 'pet',
    current: 25,
    total: 100,
    status: 'running',
  });
});

test('retains counts when a target completes with a status-only event', () => {
  const result = findTargetProgress([
    parseLogLine('@@EXPOSURE_PROGRESS {"target":"root","current":8,"total":10,"status":"running"}'),
    parseLogLine('@@EXPOSURE_PROGRESS {"target":"root","current":0,"total":0,"status":"success"}'),
  ]);

  assert.deepEqual(result, [
    { target: 'root', current: 10, total: 10, status: 'success' },
  ]);
});
