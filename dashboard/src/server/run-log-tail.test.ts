import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRunLogTail, prepareRunLogFile } from './run-log-tail';

test('자식 프로세스 로그 파일의 새 내용만 순서대로 읽음', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-run-tail-'));
  const logPath = path.join(directory, 'run.log');
  const fileDescriptor = prepareRunLogFile(logPath);
  const chunks: string[] = [];
  const tail = createRunLogTail(logPath, (chunk) => chunks.push(chunk.toString()));

  fs.writeSync(fileDescriptor, 'first\n');
  tail.readAvailable();
  fs.writeSync(fileDescriptor, 'second\n');
  tail.readAvailable();

  tail.close();
  fs.closeSync(fileDescriptor);
  assert.deepEqual(chunks, ['first\n', 'second\n']);
});
