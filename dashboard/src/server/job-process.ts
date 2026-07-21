import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { REPO_ENV_PATH, REPO_ROOT } from './paths';
import { prepareRunLogFile } from './run-log-tail';

const loadRepoEnv = (): Record<string, string> => {
  const result = dotenv.config({ path: REPO_ENV_PATH, processEnv: {} });
  return result.parsed ?? {};
};

export const spawnJobProcess = (spawnArgs: string[], logPath: string): ChildProcess => {
  let logFileDescriptor: number | undefined;
  try {
    logFileDescriptor = prepareRunLogFile(logPath);
    return spawn('pnpm', spawnArgs, {
      cwd: REPO_ROOT,
      detached: true,
      env: { ...process.env, ...loadRepoEnv() },
      stdio: ['ignore', logFileDescriptor, logFileDescriptor],
    });
  } finally {
    if (logFileDescriptor !== undefined) fs.closeSync(logFileDescriptor);
  }
};
