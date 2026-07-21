import type { ExposureExecutionMode, ExposureTargetId } from '@/shared';

export type { ExposureExecutionMode, ExposureTargetId } from '@/shared';

export type JobKind = 'standard' | 'exposure-suite';

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

export interface RunJobInput {
  jobId: string;
  options?: ExposureSuiteRunOptions;
}

export interface JobDefinition {
  id: string;
  label: string;
  description: string;
  riskNote?: string;
  kind: JobKind;
  options?: ExposureSuiteOptionDefinition;
  isRunning: boolean;
  isBlocked: boolean;
  blockReason?: string;
  executionMode?: ExposureExecutionMode;
}
