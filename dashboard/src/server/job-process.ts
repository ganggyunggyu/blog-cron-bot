import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { REPO_ENV_PATH, REPO_ROOT } from './paths';
import { prepareRunLogFile } from './run-log-tail';

const loadRepoEnv = (): Record<string, string> => {
  const result = dotenv.config({ path: REPO_ENV_PATH, processEnv: {} });
  return result.parsed ?? {};
};

export const spawnJobProcess = (
  spawnArgs: string[],
  logPath: string,
  extraEnv: Record<string, string> = {},
): ChildProcess => {
  let logFileDescriptor: number | undefined;
  try {
    logFileDescriptor = prepareRunLogFile(logPath);
    return spawn('pnpm', spawnArgs, {
      cwd: REPO_ROOT,
      detached: true,
      // extraEnv가 마지막이다. 누가 실행했는지(EXPOSURE_TENANT_LOGIN_ID)는
      // .env의 값보다 우선해야 한다.
      env: { ...process.env, ...loadRepoEnv(), ...extraEnv },
      stdio: ['ignore', logFileDescriptor, logFileDescriptor],
    });
  } finally {
    if (logFileDescriptor !== undefined) fs.closeSync(logFileDescriptor);
  }
};
