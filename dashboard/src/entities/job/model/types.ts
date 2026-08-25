import type { ExposureExecutionMode, ExposureTargetId } from '@/shared';

export type { ExposureExecutionMode, ExposureTargetId } from '@/shared';

export type JobKind = 'standard' | 'exposure-suite' | 'root-cafe-url';
export type JobSection = 'daily' | 'more' | 'tool';

export interface ExposureTargetDefinition {
  id: ExposureTargetId;
  label: string;
  description: string;
}

export interface NumericOptionDefinition {
  label: string;
  min: number;
  max: number;
  defaultValue: number;
}

export interface ExposureSuiteOptionDefinition {
  targets: ExposureTargetDefinition[];
  concurrency: NumericOptionDefinition;
  maxPages: NumericOptionDefinition;
  targetConcurrency: NumericOptionDefinition;
}

export interface ExposureSuiteRunOptions {
  targets: ExposureTargetId[];
  concurrency: number;
  maxPages: number;
  targetConcurrency: number;
}

export interface RootCafeUrlRunOptions {
  url: string;
}

export type RunJobOptions = ExposureSuiteRunOptions | RootCafeUrlRunOptions;

/** 서버가 지금 상태로 해석해준 실행 묶음. */
export interface ResolvedRunBundle {
  id: string;
  label: string;
  targets: ExposureTargetId[];
  maxPages?: number;
  droppedTargets: string[];
}

export interface JobListResult {
  jobs: JobDefinition[];
  bundles: ResolvedRunBundle[];
}

export interface RunJobInput {
  jobId: string;
  options?: RunJobOptions;
}

export interface JobDefinition {
  id: string;
  label: string;
  description: string;
  riskNote?: string;
  kind: JobKind;
  section?: JobSection;
  targetId?: string;
  options?: ExposureSuiteOptionDefinition;
  isRunning: boolean;
  isBlocked: boolean;
  blockReason?: string;
  executionMode?: ExposureExecutionMode;
}
