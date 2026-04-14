import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  parseTimeList,
  SCHEDULER_STATE_FILE,
  SCHEDULER_TICK_INTERVAL_MS,
  SCHEDULER_TIME_ZONE,
} from './constants/scheduler';
import { logger } from './lib/logger';

const execFileAsync = promisify(execFile);
dotenv.config();

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type ZonedKeys = {
  dateKey: string;
  timeKey: string;
  dateTimeLabel: string;
};

type SchedulerState = {
  lastRunByTime: Record<string, string>;
  pendingRunByTime: Record<string, string>;
};

const getStateFilePath = (): string => {
  const statePath = String(process.env.SCHEDULER_STATE_PATH || '').trim();
  if (statePath) return statePath;
  return path.join(process.cwd(), '.scheduler-state.all-sheets.json');
};

const loadSchedulerState = (): SchedulerState => {
  const stateFilePath = getStateFilePath();
  try {
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SchedulerState>;
    return {
      lastRunByTime:
        parsed.lastRunByTime && typeof parsed.lastRunByTime === 'object'
          ? (parsed.lastRunByTime as Record<string, string>)
          : {},
      pendingRunByTime:
        parsed.pendingRunByTime && typeof parsed.pendingRunByTime === 'object'
          ? (parsed.pendingRunByTime as Record<string, string>)
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
    logger.error(`[SCHED] state save failed: ${(e as Error).message}`);
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
    if (part.type === 'literal') continue;
    partMap[part.type] = part.value;
  }

  const { year = '0000', month = '00', day = '00', hour = '00', minute = '00', second = '00' } = partMap;
  const dateKey = `${year}-${month}-${day}`;
  const timeKey = `${hour}:${minute}`;
  const dateTimeLabel = `${dateKey} ${hour}:${minute}:${second}`;
  return { dateKey, timeKey, dateTimeLabel };
};

const getRunScheduleConfig = () => {
  const envTimeList = parseTimeList(String(process.env.WORKFLOW_RUN_TIMES || ''));
  if (envTimeList.length > 0) {
    return {
      runTimeList: envTimeList,
      scheduleDescription: `WORKFLOW_RUN_TIMES=${envTimeList.join(',')}`,
    };
  }

  return {
    runTimeList: ['09:00'],
    scheduleDescription: 'DEFAULT=09:00',
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

const runCommand = async (command: string, env?: NodeJS.ProcessEnv) => {
  logger.info(`▶ ${command}`);
  const { stdout, stderr } = await execFileAsync('/bin/zsh', ['-lc', command], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    maxBuffer: 1024 * 1024 * 20,
  });
  if (stdout?.trim()) logger.info(stdout.trim());
  if (stderr?.trim()) logger.warn(stderr.trim());
};

const runAllSheetsWorkflow = async () => {
  logger.summary.start('ALL-SHEETS WORKFLOW START', [
    { label: '시작', value: new Date().toLocaleString('ko-KR') },
    { label: 'OS', value: `${os.platform()} (${os.arch()})` },
  ]);

  await runCommand('pnpm cron:p');
  await runCommand('pnpm cron:root');
  await runCommand('pnpm cron:pages');

  logger.summary.complete('ALL-SHEETS WORKFLOW COMPLETE', [
    { label: '완료', value: new Date().toLocaleString('ko-KR') },
  ]);
};

const startScheduler = async (): Promise<void> => {
  const { runTimeList, scheduleDescription } = getRunScheduleConfig();
  const tickIntervalMs = getTickIntervalMs();
  const state = loadSchedulerState();
  const runTimeOrderMap = new Map<string, number>();
  runTimeList.forEach((timeKey, index) => runTimeOrderMap.set(timeKey, index));
  const runTimeSet = new Set(runTimeList);
  let isJobRunning = false;

  const now = getZonedKeys(new Date(), SCHEDULER_TIME_ZONE);
  logger.summary.start('PM2 ALL-SHEETS SCHEDULER', [
    { label: 'PID', value: String(process.pid) },
    { label: 'OS', value: `${os.platform()} ${os.arch()} (${os.release()})` },
    { label: 'TZ', value: SCHEDULER_TIME_ZONE },
    { label: '현재', value: now.dateTimeLabel },
    { label: '모드', value: scheduleDescription },
    { label: '시간', value: runTimeList.join(', ') || '(none)' },
    { label: 'TICK', value: `${Math.round(tickIntervalMs / 1000)}s` },
    { label: 'STATE', value: getStateFilePath() },
  ]);

  const runWorkflow = async (runTimeKey: string, runDateKey: string) => {
    isJobRunning = true;
    try {
      logger.box('ALL-SHEETS RUN', [`트리거: ${runTimeKey}`, `기준일: ${runDateKey}`], 'yellow');
      await runAllSheetsWorkflow();
    } catch (e) {
      logger.error(`[SCHED] workflow failed: ${(e as Error).message}`);
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
    for (const [pendingTimeKey, pendingDateKey] of Object.entries(state.pendingRunByTime)) {
      if (pendingDateKey !== dateKey || !runTimeSet.has(pendingTimeKey)) {
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
        logger.info(`[SCHED] ${dateTimeLabel} queued: ${timeKey}`);
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
      const nextTimeKey = pickNextRunTimeKey(new Set(pendingTodayList), runTimeOrderMap);
      if (nextTimeKey) {
        const runDateKey = state.pendingRunByTime[nextTimeKey];
        if (runDateKey === dateKey) {
          logger.box('SCHEDULER CATCH-UP', [`대상: ${nextTimeKey}`, `현재: ${dateTimeLabel}`], 'yellow');
          void runWorkflow(nextTimeKey, runDateKey);
        }
      }
    }

    await sleep(tickIntervalMs);
  }
};

startScheduler().catch((error) => {
  logger.error(`스케줄러 오류: ${(error as Error).message}`);
  process.exit(1);
});
