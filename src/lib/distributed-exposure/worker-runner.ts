import { spawn, type ChildProcess } from 'node:child_process';
import type { IDistributedExposureJob } from './models';
import {
  completeDistributedJob,
  failDistributedJob,
  heartbeatDistributedJob,
  recordDistributedJobWorker,
} from './queue';
import {
  buildTargetEnvironment,
  resolveTargetCommand,
} from '../exposure-suite/options';
import { logger } from '../logger';
import { getWorkerEgressIp } from './worker-egress-ip';
import { getDistributedJobTimeoutMs } from './job-timeout';

const HEARTBEAT_MS = 15_000;
const CHILD_ERROR_TAIL_LIMIT = 6_000;
const FORCE_KILL_DELAY_MS = 5_000;

const DIRECT_SHEET_TARGETS = {
  package: 'package',
  general: 'dogmaru-exclude',
  dogmaru: 'dogmaru',
} as const;

export interface WorkerChildController {
  stop: () => void;
}

const stopChild = (child: ChildProcess): void => {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
};

const runChild = (
  job: IDistributedExposureJob,
  onChild: (child: ChildProcess | undefined) => void
): Promise<void> => {
  const isPageShard =
    job.keywordIds.length > 0 &&
    (job.target === 'pet' || job.target === 'suripet');
  const directSheetTarget =
    job.target in DIRECT_SHEET_TARGETS
      ? DIRECT_SHEET_TARGETS[
          job.target as keyof typeof DIRECT_SHEET_TARGETS
        ]
      : undefined;
  const command =
    job.target === 'cafe'
      ? { script: 'exposure:cafe-current', args: [] }
      : directSheetTarget
        ? {
            script: 'exposure:direct-sheet-worker',
            args: [
              '--target',
              directSheetTarget,
              '--concurrency',
              String(job.concurrency),
              '--result-sheet',
            ],
          }
        : isPageShard
          ? {
              script: 'exposure:page-shard',
              args: [
                job.target,
                `--keyword-ids=${job.keywordIds.join(',')}`,
              ],
            }
          : resolveTargetCommand(job.target);
  const environment = buildTargetEnvironment(
    process.env,
    [job.target],
    job.concurrency,
    job.maxPages
  );
  if (job.target === 'pet' || job.target === 'suripet') {
    environment.SKIP_PAGE_CHECK_EXPORT_ALL = 'true';
  }
  if (job.target === 'root' && job.keywordIds.length > 0) {
    environment.DISTRIBUTED_EXPOSURE_SHARD = 'true';
    environment.DISTRIBUTED_EXPOSURE_KEYWORD_IDS = job.keywordIds.join(',');
  }
  delete environment.EXPOSURE_REQUEST_BROKER_URL;
  delete environment.EXPOSURE_REQUEST_BROKER_TOKEN;

  return new Promise<void>((resolve, reject) => {
    let outputTail = '';
    let timedOut = false;
    const appendOutput = (chunk: Buffer, isError: boolean): void => {
      const value = chunk.toString();
      if (isError) process.stderr.write(value);
      else process.stdout.write(value);
      outputTail = `${outputTail}${value}`.slice(-CHILD_ERROR_TAIL_LIMIT);
    };
    const child = spawn('pnpm', ['run', command.script, ...command.args], {
      cwd: process.cwd(),
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    onChild(child);
    const timeoutMs = getDistributedJobTimeoutMs();
    const timeout = setTimeout(() => {
      timedOut = true;
      stopChild(child);
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
      } else if (code === 0) resolve();
      else {
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
};

export const executeDistributedJob = async (
  job: IDistributedExposureJob,
  workerId: string,
  onChild: (child: ChildProcess | undefined) => void
): Promise<void> => {
  const jobId = String(job._id);
  let currentChild: ChildProcess | undefined;
  const trackChild = (child: ChildProcess | undefined): void => {
    currentChild = child;
    onChild(child);
  };
  const heartbeat = setInterval(() => {
    void heartbeatDistributedJob(jobId, workerId)
      .then((active) => {
        if (active || !currentChild) return;
        logger.warn(`[다중워커] 비활성 작업 종료: ${job.target}`);
        stopChild(currentChild);
      })
      .catch((error) => {
        logger.error(`[다중워커] heartbeat 실패: ${(error as Error).message}`);
      });
  }, HEARTBEAT_MS);
  heartbeat.unref();

  try {
    const egressIp = await getWorkerEgressIp();
    await recordDistributedJobWorker(jobId, workerId, egressIp);
    logger.info(
      `[다중워커] ${workerId} (${egressIp}) → ${job.target} 시작 ` +
        `(${job.attempts}/${job.maxAttempts})`
    );
    await runChild(job, trackChild);
    await completeDistributedJob(jobId, workerId);
    logger.success(`[다중워커] ${job.target} 완료`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failDistributedJob(job, workerId, message);
    logger.error(`[다중워커] ${job.target} 실패: ${message}`);
  } finally {
    clearInterval(heartbeat);
  }
};
