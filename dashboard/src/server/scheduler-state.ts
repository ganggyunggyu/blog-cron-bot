import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths';

export interface SchedulerStateInfo {
  key: string;
  label: string;
  runTimes: string[];
  lastRunByTime: Record<string, string>;
}

interface SchedulerDefinition {
  key: string;
  label: string;
  envVar: string;
  defaultRunTimes: string[];
  stateFile: string;
  statePathEnvVar: string;
}

// blog-cron-bot/src/constants/scheduler 의 기본값과 동기화됨.
// all-sheets는 ecosystem.config.cjs에서 WORKFLOW_RUN_TIMES=08:00 으로 override 되어 있어
// 이 dashboard 프로세스의 env와 실제 배포값이 다를 수 있음 (추정값으로 취급).
// statePathEnvVar는 src/pm2-scheduler*.ts의 getStateFilePath(statePathEnvName, ...) 호출과 동일한 이름으로 맞춰야 함.
const SCHEDULER_DEFINITIONS: SchedulerDefinition[] = [
  {
    key: 'keywords',
    label: '키워드 스케줄러',
    envVar: 'WORKFLOW_RUN_TIMES',
    defaultRunTimes: ['13:02'],
    stateFile: '.scheduler-state.json',
    statePathEnvVar: 'SCHEDULER_STATE_PATH',
  },
  {
    key: 'root',
    label: '루트 스케줄러',
    envVar: 'ROOT_RUN_TIMES',
    defaultRunTimes: ['13:03'],
    stateFile: '.scheduler-state.root.json',
    statePathEnvVar: 'ROOT_SCHEDULER_STATE_PATH',
  },
  {
    key: 'all-sheets',
    label: '전체 시트 스케줄러',
    envVar: 'WORKFLOW_RUN_TIMES',
    defaultRunTimes: ['09:00'],
    stateFile: '.scheduler-state.all-sheets.json',
    statePathEnvVar: 'ALL_SHEETS_SCHEDULER_STATE_PATH',
  },
];

const parseTimeList = (value: string | undefined): string[] | null => {
  if (!value) return null;
  const list = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
};

const readLastRunByTime = (definition: SchedulerDefinition): Record<string, string> => {
  const statePath =
    process.env[definition.statePathEnvVar] || path.join(REPO_ROOT, definition.stateFile);
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(raw) as { lastRunByTime?: Record<string, string> };
    return parsed.lastRunByTime ?? {};
  } catch {
    return {};
  }
};

export const getSchedulerStates = (): SchedulerStateInfo[] =>
  SCHEDULER_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    runTimes: parseTimeList(process.env[definition.envVar]) ?? definition.defaultRunTimes,
    lastRunByTime: readLastRunByTime(definition),
  }));
