import mongoose, { Document, Schema } from 'mongoose';
import type { ExposureTargetId } from '../exposure-suite/options';

export type DistributedRunStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed';
export type DistributedJobStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed';

export interface IDistributedExposureRun extends Document {
  runId: string;
  targets: ExposureTargetId[];
  status: DistributedRunStatus;
  concurrency: number;
  maxPages: number;
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
}

export interface IDistributedExposureJob extends Document {
  runId: string;
  target: ExposureTargetId;
  order: number;
  status: DistributedJobStatus;
  concurrency: number;
  maxPages: number;
  shardIndex: number;
  shardCount: number;
  keywordIds: string[];
  attempts: number;
  maxAttempts: number;
  active: boolean;
  workerId?: string;
  egressIp?: string;
  leaseUntil?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

const runSchema = new Schema<IDistributedExposureRun>(
  {
    runId: { type: String, required: true, unique: true, index: true },
    targets: { type: [String], required: true },
    status: { type: String, required: true, default: 'queued', index: true },
    concurrency: { type: Number, required: true },
    maxPages: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    error: String,
  },
  { timestamps: true }
);

const jobSchema = new Schema<IDistributedExposureJob>(
  {
    runId: { type: String, required: true, index: true },
    target: { type: String, required: true },
    order: { type: Number, required: true },
    status: { type: String, required: true, default: 'pending', index: true },
    concurrency: { type: Number, required: true },
    maxPages: { type: Number, required: true },
    shardIndex: { type: Number, required: true, default: 0 },
    shardCount: { type: Number, required: true, default: 1 },
    keywordIds: { type: [String], required: true, default: [] },
    attempts: { type: Number, required: true, default: 0 },
    maxAttempts: { type: Number, required: true, default: 2 },
    active: { type: Boolean, required: true, default: true, index: true },
    workerId: String,
    egressIp: String,
    leaseUntil: Date,
    startedAt: Date,
    finishedAt: Date,
    error: String,
  },
  { timestamps: true }
);

jobSchema.index({ runId: 1, target: 1, shardIndex: 1 }, { unique: true });
jobSchema.index({ status: 1, leaseUntil: 1, order: 1 });

export const DistributedExposureRun: mongoose.Model<IDistributedExposureRun> =
  (mongoose.models.DistributedExposureRun as
    | mongoose.Model<IDistributedExposureRun>
    | undefined) ??
  mongoose.model<IDistributedExposureRun>('DistributedExposureRun', runSchema);

export const DistributedExposureJob: mongoose.Model<IDistributedExposureJob> =
  (mongoose.models.DistributedExposureJob as
    | mongoose.Model<IDistributedExposureJob>
    | undefined) ??
  mongoose.model<IDistributedExposureJob>(
    'DistributedExposureJob',
    jobSchema
  );
