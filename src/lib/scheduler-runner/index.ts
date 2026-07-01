import os from 'os';
import { SCHEDULER_TIME_ZONE } from '../../constants/scheduler';
import { logger } from '../logger';
import {
  getStateFilePath,
  loadSchedulerState,
  saveSchedulerState,
  type SchedulerState,
} from './state';
import {
  getTickIntervalMs,
  getZonedKeys,
  pickNextRunTimeKey,
  type RunScheduleConfig,
} from './time';

export {
  getTestDelayRunScheduleConfig,
  getZonedKeys,
  type RunScheduleConfig,
} from './time';

type StartScheduledWorkflowOptions = {
  schedulerTitle: string;
  runBoxTitle: string;
  catchUpBoxTitle: string;
  logPrefix: string;
  statePathEnvName: string;
  defaultStateFile: string;
  getRunScheduleConfig: () => RunScheduleConfig;
  runWorkflow: () => Promise<void>;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const removeStalePendingRuns = (
  state: SchedulerState,
  dateKey: string,
  runTimeSet: Set<string>
): boolean => {
  let isStateUpdated = false;
  for (const [pendingTimeKey, pendingDateKey] of Object.entries(
    state.pendingRunByTime
  )) {
    if (pendingDateKey === dateKey && runTimeSet.has(pendingTimeKey)) continue;
    delete state.pendingRunByTime[pendingTimeKey];
    isStateUpdated = true;
  }
  return isStateUpdated;
};

const logSchedulerStart = (
  schedulerTitle: string,
  scheduleDescription: string,
  runTimeList: string[],
  tickIntervalMs: number,
  stateFilePath: string
): void => {
  const now = getZonedKeys(new Date());
  logger.summary.start(schedulerTitle, [
    { label: 'PID', value: String(process.pid) },
    { label: 'OS', value: `${os.platform()} ${os.arch()} (${os.release()})` },
    { label: 'TZ', value: SCHEDULER_TIME_ZONE },
    { label: '현재', value: now.dateTimeLabel },
    { label: '모드', value: scheduleDescription },
    { label: '시간', value: runTimeList.join(', ') || '(none)' },
    { label: 'TICK', value: `${Math.round(tickIntervalMs / 1000)}s` },
    { label: 'STATE', value: stateFilePath },
  ]);
};

export const startScheduledWorkflow = async ({
  schedulerTitle,
  runBoxTitle,
  catchUpBoxTitle,
  logPrefix,
  statePathEnvName,
  defaultStateFile,
  getRunScheduleConfig,
  runWorkflow,
}: StartScheduledWorkflowOptions): Promise<void> => {
  const { runTimeList, scheduleDescription } = getRunScheduleConfig();
  const tickIntervalMs = getTickIntervalMs();
  const stateFilePath = getStateFilePath(statePathEnvName, defaultStateFile);
  const state = loadSchedulerState(stateFilePath);
  const runTimeSet = new Set(runTimeList);
  const runTimeOrderMap = new Map<string, number>();
  runTimeList.forEach((timeKey, index) => runTimeOrderMap.set(timeKey, index));

  let isJobRunning = false;
  logSchedulerStart(
    schedulerTitle,
    scheduleDescription,
    runTimeList,
    tickIntervalMs,
    stateFilePath
  );

  const executeWorkflow = async (runTimeKey: string, runDateKey: string) => {
    isJobRunning = true;
    try {
      logger.box(runBoxTitle, [`트리거: ${runTimeKey}`, `기준일: ${runDateKey}`], 'yellow');
      await runWorkflow();
    } catch (e) {
      logger.error(`[${logPrefix}] workflow failed: ${(e as Error).message}`);
    } finally {
      state.lastRunByTime[runTimeKey] = runDateKey;
      delete state.pendingRunByTime[runTimeKey];
      saveSchedulerState(stateFilePath, state, logPrefix);
      isJobRunning = false;
    }
  };

  while (true) {
    const { dateKey, timeKey, dateTimeLabel } = getZonedKeys(new Date());

    if (removeStalePendingRuns(state, dateKey, runTimeSet)) {
      saveSchedulerState(stateFilePath, state, logPrefix);
    }

    const lastRunDate = state.lastRunByTime[timeKey];
    const pendingRunDate = state.pendingRunByTime[timeKey];
    if (runTimeSet.has(timeKey) && lastRunDate !== dateKey && pendingRunDate !== dateKey) {
      state.pendingRunByTime[timeKey] = dateKey;
      saveSchedulerState(stateFilePath, state, logPrefix);

      if (isJobRunning) {
        logger.info(`[${logPrefix}] ${dateTimeLabel} queued: ${timeKey}`);
      } else {
        void executeWorkflow(timeKey, dateKey);
      }

      await sleep(tickIntervalMs);
      continue;
    }

    const pendingTodayList = Object.keys(state.pendingRunByTime).filter(
      (key) => state.pendingRunByTime[key] === dateKey
    );

    if (!isJobRunning && pendingTodayList.length > 0) {
      const nextTimeKey = pickNextRunTimeKey(
        new Set(pendingTodayList),
        runTimeOrderMap
      );
      if (nextTimeKey && state.pendingRunByTime[nextTimeKey] === dateKey) {
        logger.box(catchUpBoxTitle, [`대상: ${nextTimeKey}`, `현재: ${dateTimeLabel}`], 'yellow');
        void executeWorkflow(nextTimeKey, dateKey);
      }
    }

    await sleep(tickIntervalMs);
  }
};
