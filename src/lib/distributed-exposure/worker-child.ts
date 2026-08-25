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
import {
  ROOT_CAFE_URL_TARGET,
  isAdhocTarget,
  type DistributedTargetId,
} from './adhoc-targets';
import { parseNaverCafeUrl } from '../naver-cafe-url';

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
  target: DistributedTargetId,
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

export const resolveWorkerCommand = (job: IDistributedExposureJob) => {
  // 맨 앞에 둔다. 아래 계산들은 7개 대상 중 하나라고 가정하고 도는 것들이라,
  // 여기서 안 잡으면 결국 resolveTargetCommand까지 흘러가 cron:root를 돌린다.
  if (job.jobKind === 'root-cafe-url') {
    if (job.target !== ROOT_CAFE_URL_TARGET) {
      throw new Error(`카페 URL 분산 대상이 아님: ${job.target}`);
    }
    // 워커는 다른 서비스라 잡 문서를 그대로 믿는다. 여기서 한 번 더 검증한다.
    if (!parseNaverCafeUrl(job.cafeUrl).ok) {
      throw new Error(`카페 URL이 잡 문서에 제대로 실리지 않음: ${job.cafeUrl}`);
    }
    // 키워드는 argv가 아니라 env로 넘긴다(cron-root와 같은 방식). 한글 키워드
    // 백 개를 명령줄에 실으면 길이 제한에 걸린다.
    return { script: 'exposure:root:cafe-url', args: [`--url=${job.cafeUrl}`] };
  }

  const target = job.target as ExposureTargetId;
  const concurrency = resolveDistributedWorkerConcurrency(
    target,
    job.concurrency,
    job.keywordIds.length
  );
  const isPageJob =
    job.keywordIds.length > 0 &&
    (target === 'pet' || target === 'suripet');
  const directSheetTarget =
    isDirectSheetTarget(target)
      ? DIRECT_SHEET_TARGETS[target as keyof typeof DIRECT_SHEET_TARGETS]
      : undefined;

  if (job.jobKind === 'old-logic-more') {
    if (!isOldLogicMoreTarget(target)) {
      throw new Error(`더보기 분산 대상이 아님: ${target}`);
    }
    return {
      script: 'old-logic:more-check',
      args: [
        '--sources',
        OLD_LOGIC_MORE_SOURCE_NAMES[target],
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
        '--worker-keywords',
        '--no-checkpoint',
      ],
    };
  }

  if (target === 'cafe') {
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
      args: [target, `--keyword-ids=${job.keywordIds.join(',')}`],
    };
  }
  return resolveTargetCommand(target);
};

const buildWorkerEnvironment = (
  job: IDistributedExposureJob
): NodeJS.ProcessEnv => {
  const isAdhoc = isAdhocTarget(job.target);
  const target = job.target as ExposureTargetId;
  const environment = buildTargetEnvironment(
    process.env,
    // 7개 대상용 환경변수(시트 타입, 페이지 수 등)는 카페 URL 잡에 의미가 없다.
    isAdhoc ? [] : [target],
    resolveDistributedWorkerConcurrency(
      job.target,
      job.concurrency,
      job.keywordIds.length
    ),
    job.maxPages
  );
  if (!isAdhoc && (target === 'pet' || target === 'suripet')) {
    environment.SKIP_PAGE_CHECK_EXPORT_ALL = 'true';
  }
  if (!isAdhoc && target === 'cafe') environment.SKIP_DOORAY = 'true';
  if (
    job.jobKind === 'standard' &&
    (target === 'root' || isDirectSheetTarget(target)) &&
    job.keywordIds.length > 0
  ) {
    environment.DISTRIBUTED_EXPOSURE_SHARD = 'true';
    environment.DISTRIBUTED_EXPOSURE_KEYWORD_IDS = job.keywordIds.join(',');
  }
  if (job.jobKind === 'root-cafe-url') {
    // 결과를 합칠 곳(runId)과 자기 몫(keywordIds)을 알려준다. 워커는 대시보드와
    // 다른 서비스라 파일이 아니라 Mongo로만 결과를 돌려보낼 수 있다.
    environment.DISTRIBUTED_EXPOSURE_SHARD = 'true';
    environment.DISTRIBUTED_EXPOSURE_KEYWORD_IDS = job.keywordIds.join(',');
    environment.DISTRIBUTED_EXPOSURE_RUN_ID = job.runId;
    environment.DISTRIBUTED_EXPOSURE_SHARD_INDEX = String(job.shardIndex);
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
      job.target,
      job.jobKind
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
