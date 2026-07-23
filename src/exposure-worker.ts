import { createServer, type Server } from 'node:http';
import { hostname } from 'node:os';
import type { ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from './database';
import { logger } from './lib/logger';
import {
  claimDistributedJob,
} from './lib/distributed-exposure/queue';
import { isDistributedRunFinished } from './lib/distributed-exposure/run-store';
import { executeDistributedJob } from './lib/distributed-exposure/worker-runner';
import { getWorkerJobConcurrency } from './lib/distributed-exposure/worker-capacity';

dotenv.config();

const POLL_MS = 750;
let stopping = false;
const activeChildren = new Set<ChildProcess>();

const getRunId = (): string | undefined => {
  const prefix = '--run-id=';
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const stopChildren = (): void => {
  stopping = true;
  activeChildren.forEach((child) => {
    if (!child.pid) return;
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  });
};

process.once('SIGINT', stopChildren);
process.once('SIGTERM', stopChildren);

const startHealthServer = (): Server | undefined => {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1) return undefined;

  return createServer((request, response) => {
    if (request.url === '/api/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true,"role":"exposure-worker"}\n');
      return;
    }
    response.writeHead(404);
    response.end();
  }).listen(port, '0.0.0.0');
};

const waitForPoll = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, POLL_MS));

const runWorkerSlot = async (
  workerId: string,
  runId?: string
): Promise<void> => {
  let slotChild: ChildProcess | undefined;

  while (!stopping) {
    const job = await claimDistributedJob(workerId, runId);
    if (job) {
      await executeDistributedJob(job, workerId, (child) => {
        if (slotChild) activeChildren.delete(slotChild);
        slotChild = child;
        if (child) activeChildren.add(child);
      });
      continue;
    }
    if (runId && (await isDistributedRunFinished(runId))) break;
    await waitForPoll();
  }
};

const main = async (): Promise<void> => {
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');

  const runId = getRunId();
  const workerId = `${process.env.EXPOSURE_WORKER_ID ?? hostname()}-${process.pid}`;
  const jobConcurrency = getWorkerJobConcurrency(
    process.env.DISTRIBUTED_WORKER_JOB_CONCURRENCY
  );
  await connectDB(mongoUri);
  const healthServer = startHealthServer();
  logger.info(
    `[다중워커] ${workerId} 준비 완료 · 동시 작업 ${jobConcurrency}개` +
      (runId ? ` (run ${runId})` : '')
  );

  try {
    await Promise.all(
      Array.from({ length: jobConcurrency }, () =>
        runWorkerSlot(workerId, runId)
      )
    );
  } finally {
    healthServer?.close();
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`다중 노출체크 워커 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
