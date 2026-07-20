import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  acquireExposureResourceFileLock,
  isExposureResourceFileLocked,
} from './exposure-resource-lock';

const createLockFixture = (t: test.TestContext) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-exposure-lock-'));
  const lockPath = path.join(directory, 'exposure-suite.lock');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return lockPath;
};

test('완성된 PID lock을 원자 게시하고 live lock 충돌을 거부함', (t) => {
  const lockPath = createLockFixture(t);
  const lock = acquireExposureResourceFileLock(lockPath, 101, (pid) => pid === 101);

  assert.equal(fs.readFileSync(lockPath, 'utf8'), '101');
  assert.deepEqual(fs.readdirSync(path.dirname(lockPath)), ['exposure-suite.lock']);
  assert.equal(isExposureResourceFileLocked(lockPath, (pid) => pid === 101), true);
  assert.throws(
    () => acquireExposureResourceFileLock(lockPath, 999, (pid) => pid === 101),
    { code: 'EEXIST' },
  );

  lock.release();
  assert.equal(fs.existsSync(lockPath), false);
});

test('대시보드 PID를 자식 PID로 원자 교체해 재시작 뒤에도 lock을 유지함', (t) => {
  const lockPath = createLockFixture(t);
  const lock = acquireExposureResourceFileLock(lockPath, 101, (pid) => pid === 101);

  lock.attachChildPid(202);

  assert.equal(fs.readFileSync(lockPath, 'utf8'), '202');
  assert.deepEqual(fs.readdirSync(path.dirname(lockPath)), ['exposure-suite.lock']);
  assert.equal(isExposureResourceFileLocked(lockPath, (pid) => pid === 202), true);
  lock.release();
  assert.equal(fs.existsSync(lockPath), false);
});

test('종료된 PID와 잘못된 PID lock을 정리함', (t) => {
  const lockPath = createLockFixture(t);
  fs.writeFileSync(lockPath, '303', 'utf8');
  assert.equal(isExposureResourceFileLocked(lockPath, () => false), false);
  assert.equal(fs.existsSync(lockPath), false);

  fs.writeFileSync(lockPath, '0', 'utf8');
  assert.equal(isExposureResourceFileLocked(lockPath, () => true), false);
  assert.equal(fs.existsSync(lockPath), false);
});
