import fs from 'node:fs';
import path from 'node:path';

export interface RunLock {
  release: () => void;
}

const defaultIsProcessRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

export const acquireRunLock = (
  lockPath: string,
  currentPid = process.pid,
  isProcessRunning: (pid: number) => boolean = defaultIsProcessRunning
): RunLock => {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  const pendingLockPath = `${lockPath}.${currentPid}.${process.hrtime.bigint()}.tmp`;
  fs.writeFileSync(pendingLockPath, String(currentPid), {
    encoding: 'utf8',
    flag: 'wx',
  });

  const createLock = (): void => {
    // 완성된 PID 파일을 hard-link해 빈/부분 lock 파일이 보이는 경합을 없앤다.
    fs.linkSync(pendingLockPath, lockPath);
  };

  try {
    try {
      createLock();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

      const existingPid = Number(fs.readFileSync(lockPath, 'utf8').trim());
      if (Number.isInteger(existingPid) && isProcessRunning(existingPid)) {
        throw new Error(`전체 노출체크가 이미 실행 중임 (pid=${existingPid})`);
      }

      fs.unlinkSync(lockPath);
      createLock();
    }
  } finally {
    fs.unlinkSync(pendingLockPath);
  }

  return {
    release: () => {
      try {
        const ownerPid = Number(fs.readFileSync(lockPath, 'utf8').trim());
        if (ownerPid === currentPid) fs.unlinkSync(lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },
  };
};
