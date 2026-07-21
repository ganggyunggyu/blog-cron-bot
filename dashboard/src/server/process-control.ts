import fs from 'node:fs';

export const getProcessIdentity = (processId: number): string | null => {
  if (process.platform !== 'linux') return null;
  try {
    const stat = fs.readFileSync(`/proc/${processId}/stat`, 'utf8');
    const fieldsAfterCommand = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    const startTime = fieldsAfterCommand[19];
    const bootId = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    return startTime && bootId ? `${bootId}:${startTime}` : null;
  } catch {
    return null;
  }
};

export const isSameProcess = (processId: number, identity: string | null): boolean =>
  identity !== null && getProcessIdentity(processId) === identity;

export const isProcessRunning = (processId: number): boolean => {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

export const terminateProcessGroup = (processId: number) => {
  try {
    process.kill(-processId, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
    process.kill(processId, 'SIGTERM');
  }
};
