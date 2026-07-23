import { DistributedExposureJob, DistributedExposureRun } from './models';
import type { DistributedRunInput } from './queue';
import type { DistributedRunStatus } from './models';

export const createDistributedRun = async (
  input: DistributedRunInput
): Promise<void> => {
  await DistributedExposureRun.create({
    runId: input.runId,
    targets: input.targets,
    concurrency: input.concurrency,
    maxPages: input.maxPages,
    status: 'running',
    startedAt: new Date(),
  });

  await DistributedExposureJob.insertMany(
    input.jobs.map((job, order) => ({
      runId: input.runId,
      target: job.target,
      order,
      status: 'pending',
      concurrency: input.concurrency,
      maxPages: input.maxPages,
      shardIndex: job.shardIndex ?? 0,
      shardCount: job.shardCount ?? 1,
      keywordIds: job.keywordIds ?? [],
      attempts: 0,
      maxAttempts: 3,
      active: true,
    }))
  );
};

export const finishDistributedRun = async (
  runId: string,
  status: Extract<DistributedRunStatus, 'success' | 'failed'>,
  error?: string
): Promise<void> => {
  await DistributedExposureJob.updateMany(
    { runId },
    { $set: { active: false } }
  );
  if (status === 'failed') {
    await DistributedExposureJob.updateMany(
      { runId, status: { $in: ['pending', 'running'] } },
      { $set: { status: 'failed', finishedAt: new Date(), error: error ?? '' } }
    );
  }
  await DistributedExposureRun.updateOne(
    { runId },
    { $set: { status, finishedAt: new Date(), error: error ?? '' } }
  );
};

export const assertNoActiveDistributedRun = async (): Promise<void> => {
  const activeRun = await DistributedExposureRun.findOne({
    status: { $in: ['queued', 'running'] },
  })
    .select({ runId: 1 })
    .lean()
    .exec();
  if (!activeRun) return;
  throw new Error(`이미 실행 중인 다중 워커 작업이 있음: ${activeRun.runId}`);
};

export const isDistributedRunFinished = async (
  runId: string
): Promise<boolean> => {
  const run = await DistributedExposureRun.findOne({ runId })
    .select({ status: 1 })
    .lean()
    .exec();
  return run?.status === 'success' || run?.status === 'failed';
};
