import type { ExposureTargetId } from '../exposure-suite/options';
import {
  DistributedExposureJob,
  type DistributedJobStatus,
  type IDistributedExposureJob,
} from './models';

const JOB_LEASE_MS = 60_000;

export interface DistributedRunInput {
  runId: string;
  targets: ExposureTargetId[];
  concurrency: number;
  maxPages: number;
  jobs: DistributedJobInput[];
}

export interface DistributedJobInput {
  target: ExposureTargetId;
  shardIndex?: number;
  shardCount?: number;
  keywordIds?: string[];
}

export interface DistributedRunSnapshot {
  total: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  jobs: Array<{
    target: ExposureTargetId;
    status: DistributedJobStatus;
    shardIndex: number;
    shardCount: number;
    workerId?: string;
    egressIp?: string;
  }>;
}

export const claimDistributedJob = async (
  workerId: string,
  runId?: string,
  jobId?: string
): Promise<IDistributedExposureJob | null> => {
  const now = new Date();
  const query = {
    ...(runId ? { runId } : {}),
    ...(jobId ? { _id: jobId } : {}),
    active: true,
    $and: [
      { $expr: { $lt: ['$attempts', '$maxAttempts'] } },
      {
        $or: [
          { status: 'pending' },
          { status: 'running', leaseUntil: { $lte: now } },
        ],
      },
      {
        $or: [
          { workerId: { $exists: false } },
          { workerId: { $ne: workerId } },
        ],
      },
    ],
  };

  return DistributedExposureJob.findOneAndUpdate(
    query,
    {
      $set: {
        status: 'running',
        workerId,
        leaseUntil: new Date(now.getTime() + JOB_LEASE_MS),
        startedAt: now,
        error: '',
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { order: 1, createdAt: 1 } }
  ).exec();
};

export const heartbeatDistributedJob = async (
  jobId: string,
  workerId: string
): Promise<boolean> => {
  const result = await DistributedExposureJob.updateOne(
    { _id: jobId, workerId, status: 'running', active: true },
    { $set: { leaseUntil: new Date(Date.now() + JOB_LEASE_MS) } }
  );
  return result.modifiedCount === 1;
};

export const recordDistributedJobWorker = async (
  jobId: string,
  workerId: string,
  egressIp: string
): Promise<void> => {
  const result = await DistributedExposureJob.updateOne(
    { _id: jobId, workerId, status: 'running' },
    { $set: { egressIp } }
  );
  if (result.matchedCount !== 1) {
    throw new Error(`워커 외부 IP 기록 실패: ${workerId}`);
  }
};

export const completeDistributedJob = async (
  jobId: string,
  workerId: string
): Promise<void> => {
  await DistributedExposureJob.updateOne(
    { _id: jobId, workerId, status: 'running' },
    {
      $set: { status: 'success', finishedAt: new Date() },
      $unset: { leaseUntil: 1 },
    }
  );
};

export const failDistributedJob = async (
  job: IDistributedExposureJob,
  workerId: string,
  error: string,
  retryKeywordIds?: string[]
): Promise<boolean> => {
  const shouldRetry = job.attempts < job.maxAttempts;
  const statusUpdate = shouldRetry
    ? { status: 'pending' as const, error }
    : { status: 'failed' as const, finishedAt: new Date(), error };
  await DistributedExposureJob.updateOne(
    { _id: job._id, workerId, status: 'running' },
    {
      $set: {
        ...statusUpdate,
        ...(retryKeywordIds ? { keywordIds: retryKeywordIds } : {}),
      },
      $unset: shouldRetry
        ? { leaseUntil: 1 }
        : { leaseUntil: 1, workerId: 1 },
    }
  );
  return shouldRetry;
};

export const getDistributedRunSnapshot = async (
  runId: string
): Promise<DistributedRunSnapshot> => {
  const jobs = await DistributedExposureJob.find({ runId })
    .sort({ order: 1 })
    .select({
      target: 1,
      status: 1,
      shardIndex: 1,
      shardCount: 1,
      workerId: 1,
      egressIp: 1,
    })
    .lean()
    .exec();
  const count = (status: DistributedJobStatus): number =>
    jobs.filter((job) => job.status === status).length;

  return {
    total: jobs.length,
    pending: count('pending'),
    running: count('running'),
    success: count('success'),
    failed: count('failed'),
    jobs: jobs.map((job) => ({
      target: job.target as ExposureTargetId,
      status: job.status,
      shardIndex: job.shardIndex,
      shardCount: job.shardCount,
      workerId: job.workerId,
      egressIp: job.egressIp,
    })),
  };
};
