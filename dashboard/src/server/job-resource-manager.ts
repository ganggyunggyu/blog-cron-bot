import {
  acquireExposureResourceFileLock,
  isExposureResourceFileLocked,
  type ExposureResourceFileLock,
} from './exposure-resource-lock';
import { JobConflictError } from './job-errors';
import type { JobDefinition, JobResourceGroup } from './job-registry';

export interface JobResourceReservation {
  attachChildPid: (childPid: number) => void;
  release: () => void;
}

const activeResourceRuns = new Map<JobResourceGroup, string>();

export const usesSuiteRunLock = (job: JobDefinition): boolean =>
  job.kind === 'exposure-suite' || job.script.startsWith('exposure:');

const hasResourceConflict = (job: JobDefinition): boolean => {
  if (!job.resourceGroup) return false;
  if (activeResourceRuns.has(job.resourceGroup)) return true;
  return job.resourceGroup === 'exposure' && isExposureResourceFileLocked();
};

export const isJobResourceBlocked = (job: JobDefinition, isJobActive: boolean): boolean =>
  !isJobActive && hasResourceConflict(job);

export const reserveJobResource = (
  job: JobDefinition,
  runId: string,
): JobResourceReservation => {
  const { resourceGroup } = job;
  if (!resourceGroup) {
    return { attachChildPid: () => undefined, release: () => undefined };
  }
  if (hasResourceConflict(job)) {
    throw new JobConflictError('다른 노출체크가 이미 실행 중임');
  }

  let fileLock: ExposureResourceFileLock | undefined;
  try {
    if (!usesSuiteRunLock(job)) {
      fileLock = acquireExposureResourceFileLock();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new JobConflictError('다른 노출체크가 이미 실행 중임');
    }
    throw error;
  }

  activeResourceRuns.set(resourceGroup, runId);
  return {
    attachChildPid: (childPid) => fileLock?.attachChildPid(childPid),
    release: () => {
      if (activeResourceRuns.get(resourceGroup) === runId) {
        activeResourceRuns.delete(resourceGroup);
      }
      fileLock?.release();
    },
  };
};
