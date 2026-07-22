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

const HEARTBEAT_MS = 15_000;
const CHILD_ERROR_TAIL_LIMIT = 6_000;

const DIRECT_SHEET_TARGETS = {
  package: 'package',
  general: 'dogmaru-exclude',
  dogmaru: 'dogmaru',
} as const;

export interface WorkerChildController {
  stop: () => void;
}

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
              '--skip-dooray',
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
    child.stdout?.on('data', (chunk: Buffer) => appendOutput(chunk, false));
    child.stderr?.on('data', (chunk: Buffer) => appendOutput(chunk, true));
    child.once('error', reject);
    child.once('close', (code) => {
      onChild(undefined);
      if (code === 0) resolve();
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
  const heartbeat = setInterval(() => {
    void heartbeatDistributedJob(jobId, workerId).catch((error) => {
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
    await runChild(job, onChild);
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
