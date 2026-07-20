import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireRunLock } from './run-lock';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exposure-suite-lock-'));
const lockPath = path.join(tempDir, 'suite.lock');

const first = acquireRunLock(lockPath, 101, () => true);
assert.equal(fs.readFileSync(lockPath, 'utf8'), '101');
assert.throws(
  () => acquireRunLock(lockPath, 202, () => true),
  /이미 실행 중/
);
first.release();
assert.equal(fs.existsSync(lockPath), false);

fs.writeFileSync(lockPath, '303', 'utf8');
const recovered = acquireRunLock(lockPath, 404, () => false);
assert.equal(fs.readFileSync(lockPath, 'utf8'), '404');
recovered.release();

fs.writeFileSync(lockPath, '', 'utf8');
const recoveredFromIncompleteLock = acquireRunLock(lockPath, 505, () => false);
assert.equal(fs.readFileSync(lockPath, 'utf8'), '505');
recoveredFromIncompleteLock.release();
assert.deepEqual(
  fs.readdirSync(tempDir).filter((file) => file.endsWith('.tmp')),
  []
);
fs.rmSync(tempDir, { recursive: true });

process.stdout.write('exposure suite run lock tests passed\n');
