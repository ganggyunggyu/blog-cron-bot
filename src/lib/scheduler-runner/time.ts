import {
  SCHEDULER_TICK_INTERVAL_MS,
  SCHEDULER_TIME_ZONE,
} from '../../constants/scheduler';

export type ZonedKeys = {
  dateKey: string;
  timeKey: string;
  dateTimeLabel: string;
};

export type RunScheduleConfig = {
  runTimeList: string[];
  scheduleDescription: string;
};

export const getZonedKeys = (
  date: Date,
  timeZone = SCHEDULER_TIME_ZONE
): ZonedKeys => {
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

  const partMap: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
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

  return {
    dateKey: `${year}-${month}-${day}`,
    timeKey: `${hour}:${minute}`,
    dateTimeLabel: `${year}-${month}-${day} ${hour}:${minute}:${second}`,
  };
};

export const getTestDelayRunScheduleConfig = (): RunScheduleConfig | null => {
  const testDelayMinutes = Number(process.env.TEST_DELAY_MINUTES || '0');
  if (!Number.isFinite(testDelayMinutes) || testDelayMinutes <= 0) return null;

  const targetDate = new Date(Date.now() + testDelayMinutes * 60 * 1000);
  const { timeKey, dateTimeLabel } = getZonedKeys(targetDate);
  return {
    runTimeList: [timeKey],
    scheduleDescription: `TEST_DELAY_MINUTES=${testDelayMinutes} (${dateTimeLabel})`,
  };
};

export const getTickIntervalMs = (): number => {
  const envMs = Number(process.env.SCHEDULER_TICK_INTERVAL_MS || '');
  if (Number.isFinite(envMs) && envMs > 0) return envMs;
  return SCHEDULER_TICK_INTERVAL_MS;
};

export const pickNextRunTimeKey = (
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
