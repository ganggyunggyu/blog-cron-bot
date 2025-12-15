import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { main as runRootWorkflow } from './cron-root';
import {
  parseTimeList,
  ROOT_RUN_TIME_LIST,
  ROOT_SCHEDULER_STATE_FILE,
  SCHEDULER_TICK_INTERVAL_MS,
  SCHEDULER_TIME_ZONE,
} from './constants/scheduler';

dotenv.config();

type ZonedKeys = {
  dateKey: string;
  timeKey: string;
  dateTimeLabel: string;
};

type SchedulerState = {
  lastRunByTime: Record<string, string>;
  pendingRunByTime: Record<string, string>;
};

const log = {
  box: (title: string, content: string[]) => {
    const width = 50;
    const line = '─'.repeat(width);
    console.log(`\n┌${line}┐`);
    console.log(`│ ${title.padEnd(width - 1)}│`);
    console.log(`├${line}┤`);
    content.forEach((c) => console.log(`│ ${c.padEnd(width - 1)}│`));
    console.log(`└${line}┘`);
  },
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getStateFilePath = (): string => {
  const statePath = String(process.env.ROOT_SCHEDULER_STATE_PATH || '').trim();
  if (statePath) return statePath;
  return path.join(process.cwd(), ROOT_SCHEDULER_STATE_FILE);
};

const loadSchedulerState = (): SchedulerState => {
  const stateFilePath = getStateFilePath();
  try {
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SchedulerState>;
    const lastRunByTime = parsed?.lastRunByTime;
    const pendingRunByTime = parsed?.pendingRunByTime;

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

const saveSchedulerState = (state: SchedulerState): void => {
  const stateFilePath = getStateFilePath();
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[ROOT_SCHED] state save failed:', (e as Error).message);
  }
};

const getZonedKeys = (date: Date, timeZone: string): ZonedKeys => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const partList = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of partList) {
    const { type, value } = part;
    if (type === 'literal') continue;
    partMap[type] = value;
  }

  const {
    year = '0000',
    month = '00',
    day = '00',
    hour = '00',
    minute = '00',
    second = '00',
  } = partMap;

  const dateKey = `${year}-${month}-${day}`;
  const timeKey = `${hour}:${minute}`;
  const dateTimeLabel = `${dateKey} ${hour}:${minute}:${second}`;
  return { dateKey, timeKey, dateTimeLabel };
};

type RunScheduleConfig = {
  runTimeList: string[];
  scheduleDescription: string;
};

const getRunScheduleConfig = (): RunScheduleConfig => {
  const testDelayMinutes = Number(process.env.TEST_DELAY_MINUTES || '0');
  if (Number.isFinite(testDelayMinutes) && testDelayMinutes > 0) {
    const targetDate = new Date(Date.now() + testDelayMinutes * 60 * 1000);
    const { timeKey, dateTimeLabel } = getZonedKeys(
      targetDate,
      SCHEDULER_TIME_ZONE
    );
    return {
      runTimeList: [timeKey],
      scheduleDescription: `TEST_DELAY_MINUTES=${testDelayMinutes} (${dateTimeLabel})`,
    };
  }

  const envTimeList = parseTimeList(String(process.env.ROOT_RUN_TIMES || ''));
  if (envTimeList.length > 0) {
    return {
      runTimeList: envTimeList,
      scheduleDescription: `ROOT_RUN_TIMES=${envTimeList.join(',')}`,
    };
  }

  return {
    runTimeList: [...ROOT_RUN_TIME_LIST],
    scheduleDescription: `DEFAULT=${ROOT_RUN_TIME_LIST.join(',')}`,
  };
};

const getTickIntervalMs = (): number => {
  const envMs = Number(process.env.SCHEDULER_TICK_INTERVAL_MS || '');
  if (Number.isFinite(envMs) && envMs > 0) return envMs;
  return SCHEDULER_TICK_INTERVAL_MS;
};

const pickNextRunTimeKey = (
  pendingRunTimeSet: Set<string>,
  runTimeOrderMap: Map<string, number>
): string | null => {
  if (pendingRunTimeSet.size === 0) return null;

  const pendingList = Array.from(pendingRunTimeSet);
  pendingList.sort((a, b) => {
    const aOrder = runTimeOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = runTimeOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
  return pendingList[0] ?? null;
};

const startRootScheduler = async (): Promise<void> => {
  const { runTimeList, scheduleDescription } = getRunScheduleConfig();
  const tickIntervalMs = getTickIntervalMs();
  const state = loadSchedulerState();

  const runTimeOrderMap = new Map<string, number>();
  runTimeList.forEach((timeKey, index) => runTimeOrderMap.set(timeKey, index));
  const runTimeSet = new Set(runTimeList);

  let isJobRunning = false;

  const now = getZonedKeys(new Date(), SCHEDULER_TIME_ZONE);
  log.box('PM2 ROOT SCHEDULER', [
    `PID: ${process.pid}`,
    `OS: ${os.platform()} ${os.arch()} (${os.release()})`,
    `TZ: ${SCHEDULER_TIME_ZONE}`,
    `현재: ${now.dateTimeLabel}`,
    `모드: ${scheduleDescription}`,
    `시간: ${runTimeList.join(', ') || '(none)'}`,
    `TICK: ${Math.round(tickIntervalMs / 1000)}s`,
    `STATE: ${getStateFilePath()}`,
  ]);

  const runWorkflow = async (runTimeKey: string, runDateKey: string) => {
    isJobRunning = true;
    try {
      log.box('ROOT WORKFLOW RUN', [
        `트리거: ${runTimeKey}`,
        `기준일: ${runDateKey}`,
      ]);
      await runRootWorkflow();
    } catch (e) {
      console.error('[ROOT_SCHED] workflow failed:', (e as Error).message);
    } finally {
      state.lastRunByTime[runTimeKey] = runDateKey;
      delete state.pendingRunByTime[runTimeKey];
      saveSchedulerState(state);
      isJobRunning = false;
    }
  };

  while (true) {
    const current = getZonedKeys(new Date(), SCHEDULER_TIME_ZONE);
    const { dateKey, timeKey, dateTimeLabel } = current;

    let isStateUpdated = false;
    for (const [pendingTimeKey, pendingDateKey] of Object.entries(
      state.pendingRunByTime
    )) {
      if (pendingDateKey !== dateKey) {
        delete state.pendingRunByTime[pendingTimeKey];
        isStateUpdated = true;
        continue;
      }
      if (!runTimeSet.has(pendingTimeKey)) {
        delete state.pendingRunByTime[pendingTimeKey];
        isStateUpdated = true;
      }
    }
    if (isStateUpdated) saveSchedulerState(state);

    const isScheduled = runTimeSet.has(timeKey);
    const lastRunDate = state.lastRunByTime[timeKey];
    const pendingRunDate = state.pendingRunByTime[timeKey];

    if (isScheduled && lastRunDate !== dateKey && pendingRunDate !== dateKey) {
      state.pendingRunByTime[timeKey] = dateKey;
      saveSchedulerState(state);

      if (isJobRunning) {
        console.log(`[ROOT_SCHED] ${dateTimeLabel} queued: ${timeKey}`);
      } else {
        void runWorkflow(timeKey, dateKey);
      }

      await sleep(tickIntervalMs);
      continue;
    }

    const pendingTodayList = Object.keys(state.pendingRunByTime).filter(
      (k) => state.pendingRunByTime[k] === dateKey
    );

    if (!isJobRunning && pendingTodayList.length > 0) {
      const nextTimeKey = pickNextRunTimeKey(
        new Set(pendingTodayList),
        runTimeOrderMap
      );
      if (nextTimeKey) {
        const runDateKey = state.pendingRunByTime[nextTimeKey];
        if (runDateKey === dateKey) {
          log.box('ROOT SCHEDULER CATCH-UP', [
            `대상: ${nextTimeKey}`,
            `현재: ${dateTimeLabel}`,
          ]);
          void runWorkflow(nextTimeKey, runDateKey);
        }
      }
    }

    await sleep(tickIntervalMs);
  }
};

startRootScheduler().catch((error) => {
  console.error('❌ 루트 스케줄러 오류:', error);
  process.exit(1);
});

