import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { Response } from 'express';

export type CronMode = 'cron-test' | 'cron-root' | 'cron-pages';

interface CronRunStatus {
  running: boolean;
  mode: CronMode | null;
}

interface CronRunConfig {
  command: string;
  args: string[];
}

const ROOT_DIR = path.join(__dirname, '../../../');
const PNPM_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const CRON_CONFIGS: Record<CronMode, CronRunConfig> = {
  'cron-test': { command: PNPM_COMMAND, args: ['cron:test'] },
  'cron-root': { command: PNPM_COMMAND, args: ['cron:root'] },
  'cron-pages': { command: PNPM_COMMAND, args: ['cron:pages'] },
};

let activeProcess: ChildProcessWithoutNullStreams | null = null;
let activeMode: CronMode | null = null;

export const getCronStatus = (): CronRunStatus => {
  return { running: !!activeProcess, mode: activeMode };
};

export const streamCronRun = (mode: CronMode, res: Response): void => {
  const config = CRON_CONFIGS[mode];
  const child = spawn(config.command, config.args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcess = child;
  activeMode = mode;

  const send = (event: string, payload: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send('status', { status: 'started', mode });

  const handleChunk = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
    send('log', { stream, chunk: chunk.toString('utf-8') });
  };

  child.stdout.on('data', handleChunk('stdout'));
  child.stderr.on('data', handleChunk('stderr'));

  const cleanup = () => {
    if (activeProcess === child) {
      activeProcess = null;
      activeMode = null;
    }
  };

  child.on('close', (code, signal) => {
    send('done', { code, signal });
    cleanup();
    res.end();
  });

  child.on('error', (error) => {
    send('done', { code: 1, signal: null, error: error.message });
    cleanup();
    res.end();
  });

  res.on('close', () => {
    if (activeProcess === child && !child.killed) {
      child.kill('SIGTERM');
    }
    cleanup();
  });
};
