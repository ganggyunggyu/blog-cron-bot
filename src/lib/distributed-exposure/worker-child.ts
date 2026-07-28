import { spawn, type ChildProcess } from 'node:child_process';
import {
  AUTO_KEYWORD_CONCURRENCY,
  buildTargetEnvironment,
  resolveKeywordConcurrency,
  resolveTargetCommand,
} from '../exposure-suite/options';
import type { ExposureTargetId } from '../exposure-suite/options';
import { getDistributedJobTimeoutMs } from './job-timeout';
import type { IDistributedExposureJob } from './models';
import {
  OLD_LOGIC_MORE_SOURCE_NAMES,
  isOldLogicMoreTarget,
} from './job-planner';

const CHILD_ERROR_TAIL_LIMIT = 6_000;
const FORCE_KILL_DELAY_MS = 5_000;

const DIRECT_SHEET_TARGETS = {
  package: 'package',
  general: 'dogmaru-exclude',
  dogmaru: 'dogmaru',
} as const;

const isDirectSheetTarget = (
  target: ExposureTargetId
): target is keyof typeof DIRECT_SHEET_TARGETS => target in DIRECT_SHEET_TARGETS;

const getOldLogicMoreWorkerOutputTitle = (
  job: IDistributedExposureJob
): string => `__more_${job.runId}_${job.target}_${job.shardIndex}`;

export const resolveDistributedWorkerConcurrency = (
  target: ExposureTargetId,
  configuredConcurrency: number,
  keywordCount = 0
): number =>
  configuredConcurrency === AUTO_KEYWORD_CONCURRENCY && keywordCount > 0
    ? Math.max(1, keywordCount)
    : resolveKeywordConcurrency(configuredConcurrency);

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
  const concurrency = resolveDistributedWorkerConcurrency(
    job.target,
    job.concurrency,
    job.keywordIds.length
  );
  const isPageJob =
    job.keywordIds.length > 0 &&
    (job.target === 'pet' || job.target === 'suripet');
  const directSheetTarget =
    isDirectSheetTarget(job.target)
      ? DIRECT_SHEET_TARGETS[
          job.target as keyof typeof DIRECT_SHEET_TARGETS
        ]
      : undefined;

  if (job.jobKind === 'old-logic-more') {
    if (!isOldLogicMoreTarget(job.target)) {
      throw new Error(`더보기 분산 대상이 아님: ${job.target}`);
    }
    return {
      script: 'old-logic:more-check',
      args: [
        '--sources',
        OLD_LOGIC_MORE_SOURCE_NAMES[job.target],
        '--keywords',
        job.keywordIds.join(','),
        '--output-title',
        getOldLogicMoreWorkerOutputTitle(job),
        '--concurrency',
        '1',
        '--max-results',
        '50',
        '--all-matches',
        '--worker-output',
        '--no-checkpoint',
      ],
    };
  }

  if (job.target === 'cafe') {
    return { script: 'exposure:cafe-current', args: [] };
  }
  if (directSheetTarget) {
    if (job.keywordIds.length > 0) {
      return { script: 'dev', args: [] };
    }
    return {
      script: 'exposure:direct-sheet-worker',
      args: [
        '--target',
        directSheetTarget,
        '--concurrency',
        String(concurrency),
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
    resolveDistributedWorkerConcurrency(
      job.target,
      job.concurrency,
      job.keywordIds.length
    ),
    job.maxPages
  );
  if (job.target === 'pet' || job.target === 'suripet') {
    environment.SKIP_PAGE_CHECK_EXPORT_ALL = 'true';
  }
  if (job.target === 'cafe') environment.SKIP_DOORAY = 'true';
  if (
    job.jobKind !== 'old-logic-more' &&
    (job.target === 'root' || isDirectSheetTarget(job.target)) &&
    job.keywordIds.length > 0
  ) {
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
    const timeoutMs = getDistributedJobTimeoutMs(
      process.env.DISTRIBUTED_EXPOSURE_JOB_TIMEOUT_MINUTES,
      job.target
    );
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
