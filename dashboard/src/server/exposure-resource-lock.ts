import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EXPOSURE_SUITE_LOCK_PATH } from './paths';

type ProcessLivenessCheck = (pid: number) => boolean;

export interface ExposureResourceFileLock {
  attachChildPid: (childPid: number) => void;
  release: () => void;
}

const defaultIsProcessRunning: ProcessLivenessCheck = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const removeFileIfPresent = (filePath: string) => {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

const createTempPidFile = (lockPath: string, pid: number): string => {
  const tempPath = `${lockPath}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, String(pid), { encoding: 'utf8', flag: 'wx' });
  return tempPath;
};

const publishNewLock = (lockPath: string, pid: number) => {
  const tempPath = createTempPidFile(lockPath, pid);
  try {
    fs.linkSync(tempPath, lockPath);
  } finally {
    removeFileIfPresent(tempPath);
  }
};

const replaceLockOwner = (lockPath: string, currentPid: number, nextPid: number) => {
  const ownerPid = Number(fs.readFileSync(lockPath, 'utf8').trim());
  if (ownerPid !== currentPid) throw new Error('노출체크 잠금 소유자가 변경됨');

  const tempPath = createTempPidFile(lockPath, nextPid);
  try {
    fs.renameSync(tempPath, lockPath);
  } finally {
    removeFileIfPresent(tempPath);
  }
};

export const isExposureResourceFileLocked = (
  lockPath = EXPOSURE_SUITE_LOCK_PATH,
  isProcessRunning: ProcessLivenessCheck = defaultIsProcessRunning,
): boolean => {
  try {
    const ownerPid = Number(fs.readFileSync(lockPath, 'utf8').trim());
    if (Number.isInteger(ownerPid) && ownerPid > 0 && isProcessRunning(ownerPid)) return true;
    removeFileIfPresent(lockPath);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

export const acquireExposureResourceFileLock = (
  lockPath = EXPOSURE_SUITE_LOCK_PATH,
  initialOwnerPid = process.pid,
  isProcessRunning: ProcessLivenessCheck = defaultIsProcessRunning,
): ExposureResourceFileLock => {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  try {
    publishNewLock(lockPath, initialOwnerPid);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (isExposureResourceFileLocked(lockPath, isProcessRunning)) throw error;
    publishNewLock(lockPath, initialOwnerPid);
  }

  let ownerPid = initialOwnerPid;
  return {
    attachChildPid: (childPid) => {
      if (!Number.isInteger(childPid) || childPid <= 0) {
        throw new Error('자식 프로세스 PID가 올바르지 않음');
      }
      replaceLockOwner(lockPath, ownerPid, childPid);
      ownerPid = childPid;
    },
    release: () => {
      try {
        const currentOwnerPid = Number(fs.readFileSync(lockPath, 'utf8').trim());
        if (currentOwnerPid === ownerPid) removeFileIfPresent(lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },
  };
};
