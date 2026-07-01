import dotenv from 'dotenv';
import { main as runRootWorkflow } from './cron-root';
import {
  parseTimeList,
  ROOT_RUN_TIME_LIST,
  ROOT_SCHEDULER_STATE_FILE,
} from './constants/scheduler';
import { logger } from './lib/logger';
import {
  getTestDelayRunScheduleConfig,
  type RunScheduleConfig,
  startScheduledWorkflow,
} from './lib/scheduler-runner';

dotenv.config();

const getRunScheduleConfig = (): RunScheduleConfig => {
  const testConfig = getTestDelayRunScheduleConfig();
  if (testConfig) return testConfig;

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

const startRootScheduler = async (): Promise<void> => {
  await startScheduledWorkflow({
    schedulerTitle: 'PM2 ROOT SCHEDULER',
    runBoxTitle: 'ROOT WORKFLOW RUN',
    catchUpBoxTitle: 'ROOT SCHEDULER CATCH-UP',
    logPrefix: 'ROOT_SCHED',
    statePathEnvName: 'ROOT_SCHEDULER_STATE_PATH',
    defaultStateFile: ROOT_SCHEDULER_STATE_FILE,
    getRunScheduleConfig,
    runWorkflow: runRootWorkflow,
  });
};

startRootScheduler().catch((error) => {
  logger.error(`루트 스케줄러 오류: ${(error as Error).message}`);
  process.exit(1);
});
