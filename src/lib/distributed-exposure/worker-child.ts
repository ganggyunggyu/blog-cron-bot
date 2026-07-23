import { spawn, type ChildProcess } from 'node:child_process';
import {
  buildTargetEnvironment,
  resolveTargetCommand,
} from '../exposure-suite/options';
import { getDistributedJobTimeoutMs } from './job-timeout';
import type { IDistributedExposureJob } from './models';

const CHILD_ERROR_TAIL_LIMIT = 6_000;
const FORCE_KILL_DELAY_MS = 5_000;

const DIRECT_SHEET_TARGETS = {
  package: 'package',
  general: 'dogmaru-exclude',
  dogmaru: 'dogmaru',
} as const;

export const stopWorkerChild = (child: ChildProcess): void => {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
};

const resolveWorkerCommand = (job: IDistributedExposureJob) => {
  const isPageJob =
    job.keywordIds.length > 0 &&
    (job.target === 'pet' || job.target === 'suripet');
  const directSheetTarget =
    job.target in DIRECT_SHEET_TARGETS
      ? DIRECT_SHEET_TARGETS[
          job.target as keyof typeof DIRECT_SHEET_TARGETS
        ]
      : undefined;

  if (job.target === 'cafe') {
    return { script: 'exposure:cafe-current', args: [] };
  }
  if (directSheetTarget) {
    return {
      script: 'exposure:direct-sheet-worker',
      args: [
        '--target',
        directSheetTarget,
        '--concurrency',
        String(job.concurrency),
        '--result-sheet',
        '--skip-dooray',
      ],
    };
  }
  if (isPageJob) {
    return {
      script: 'exposure:page-shard',
      args: [job.target, `--keyword-ids=${job.keywordIds.join(',')}`],
    };
  }
  return resolveTargetCommand(job.target);
};

const buildWorkerEnvironment = (
  job: IDistributedExposureJob
): NodeJS.ProcessEnv => {
  const environment = buildTargetEnvironment(
    process.env,
    [job.target],
    job.concurrency,
    job.maxPages
  );
  if (job.target === 'pet' || job.target === 'suripet') {
    environment.SKIP_PAGE_CHECK_EXPORT_ALL = 'true';
  }
  if (job.target === 'cafe') environment.SKIP_DOORAY = 'true';
  if (job.target === 'root' && job.keywordIds.length > 0) {
    environment.DISTRIBUTED_EXPOSURE_SHARD = 'true';
    environment.DISTRIBUTED_EXPOSURE_KEYWORD_IDS = job.keywordIds.join(',');
  }
  delete environment.EXPOSURE_REQUEST_BROKER_URL;
  delete environment.EXPOSURE_REQUEST_BROKER_TOKEN;
  return environment;
};

export const runWorkerChild = (
  job: IDistributedExposureJob,
  onChild: (child: ChildProcess | undefined) => void
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let outputTail = '';
    let timedOut = false;
    const command = resolveWorkerCommand(job);
    const child = spawn('pnpm', ['run', command.script, ...command.args], {
      cwd: process.cwd(),
      env: buildWorkerEnvironment(job),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const appendOutput = (chunk: Buffer, isError: boolean): void => {
      const value = chunk.toString();
      if (isError) process.stderr.write(value);
      else process.stdout.write(value);
      outputTail = `${outputTail}${value}`.slice(-CHILD_ERROR_TAIL_LIMIT);
    };
    onChild(child);
    const timeoutMs = getDistributedJobTimeoutMs();
    const timeout = setTimeout(() => {
      timedOut = true;
      stopWorkerChild(child);
      const forceKill = setTimeout(() => {
        if (!child.pid || child.exitCode !== null) return;
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
      }, FORCE_KILL_DELAY_MS);
      forceKill.unref();
    }, timeoutMs);
    timeout.unref();
    child.stdout?.on('data', (chunk: Buffer) => appendOutput(chunk, false));
    child.stderr?.on('data', (chunk: Buffer) => appendOutput(chunk, true));
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      onChild(undefined);
      if (timedOut) {
        reject(
          new Error(
            `${job.target} 작업이 ${Math.floor(timeoutMs / 60_000)}분 제한을 초과함`
          )
        );
      } else if (code === 0) {
        resolve();
      } else {
        const detail = outputTail.trim();
        reject(
          new Error(
            `${job.target} 종료 코드 ${code ?? 'unknown'}` +
              (detail ? `\n${detail}` : '')
          )
        );
      }
    });
  });
