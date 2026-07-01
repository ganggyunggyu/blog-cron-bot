import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

export type SchedulerState = {
  lastRunByTime: Record<string, string>;
  pendingRunByTime: Record<string, string>;
};

export const getStateFilePath = (
  statePathEnvName: string,
  defaultStateFile: string
): string => {
  const statePath = String(process.env[statePathEnvName] || '').trim();
  if (statePath) return statePath;
  return path.join(process.cwd(), defaultStateFile);
};

export const loadSchedulerState = (stateFilePath: string): SchedulerState => {
  try {
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SchedulerState>;
    const { lastRunByTime, pendingRunByTime } = parsed;

    return {
      lastRunByTime:
        lastRunByTime && typeof lastRunByTime === 'object'
          ? (lastRunByTime as Record<string, string>)
          : {},
      pendingRunByTime:
        pendingRunByTime && typeof pendingRunByTime === 'object'
          ? (pendingRunByTime as Record<string, string>)
          : {},
    };
  } catch {
    return { lastRunByTime: {}, pendingRunByTime: {} };
  }
};

export const saveSchedulerState = (
  stateFilePath: string,
  state: SchedulerState,
  logPrefix: string
): void => {
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
  } catch (e) {
    logger.error(`[${logPrefix}] state save failed: ${(e as Error).message}`);
  }
};
