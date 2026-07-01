import assert from 'node:assert/strict';
import { SCHEDULER_TICK_INTERVAL_MS } from '../../constants/scheduler';
import {
  getTestDelayRunScheduleConfig,
  getTickIntervalMs,
  getZonedKeys,
  pickNextRunTimeKey,
} from './time';

const withEnv = <T>(
  name: string,
  value: string | undefined,
  callback: () => T
): T => {
  const previousValue = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    return callback();
  } finally {
    if (previousValue === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previousValue;
    }
  }
};

const zonedKeys = getZonedKeys(new Date('2026-07-01T03:04:05.000Z'));
assert.deepEqual(zonedKeys, {
  dateKey: '2026-07-01',
  timeKey: '12:04',
  dateTimeLabel: '2026-07-01 12:04:05',
});

assert.equal(
  withEnv('SCHEDULER_TICK_INTERVAL_MS', undefined, getTickIntervalMs),
  SCHEDULER_TICK_INTERVAL_MS
);
assert.equal(withEnv('SCHEDULER_TICK_INTERVAL_MS', '2500', getTickIntervalMs), 2500);
assert.equal(
  withEnv('SCHEDULER_TICK_INTERVAL_MS', 'not-a-number', getTickIntervalMs),
  SCHEDULER_TICK_INTERVAL_MS
);

const orderedTime = pickNextRunTimeKey(
  new Set(['13:03', '09:00', '13:02']),
  new Map([
    ['13:02', 0],
    ['13:03', 1],
  ])
);
assert.equal(orderedTime, '13:02');

const lexicographicFallbackTime = pickNextRunTimeKey(
  new Set(['10:00', '08:00']),
  new Map()
);
assert.equal(lexicographicFallbackTime, '08:00');
assert.equal(pickNextRunTimeKey(new Set(), new Map()), null);

assert.equal(
  withEnv('TEST_DELAY_MINUTES', undefined, getTestDelayRunScheduleConfig),
  null
);

const testDelayConfig = withEnv(
  'TEST_DELAY_MINUTES',
  '5',
  getTestDelayRunScheduleConfig
);
assert.equal(testDelayConfig?.runTimeList.length, 1);
assert.match(testDelayConfig?.runTimeList[0] ?? '', /^\d{2}:\d{2}$/);
assert.match(
  testDelayConfig?.scheduleDescription ?? '',
  /^TEST_DELAY_MINUTES=5 \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\)$/
);

process.stdout.write('scheduler time tests passed\n');
