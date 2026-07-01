import { execFile } from 'child_process';
import dotenv from 'dotenv';
import os from 'os';
import { promisify } from 'util';
import { parseTimeList } from './constants/scheduler';
import { logger } from './lib/logger';
import {
  type RunScheduleConfig,
  startScheduledWorkflow,
} from './lib/scheduler-runner';

const execFileAsync = promisify(execFile);
dotenv.config();

const getRunScheduleConfig = (): RunScheduleConfig => {
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

const runCommand = async (
  command: string,
  env?: NodeJS.ProcessEnv
): Promise<void> => {
  logger.info(`▶ ${command}`);
  const { stdout, stderr } = await execFileAsync('/bin/zsh', ['-lc', command], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    maxBuffer: 1024 * 1024 * 20,
  });

  if (stdout?.trim()) logger.info(stdout.trim());
  if (stderr?.trim()) logger.warn(stderr.trim());
};

const runAllSheetsWorkflow = async (): Promise<void> => {
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
  await startScheduledWorkflow({
    schedulerTitle: 'PM2 ALL-SHEETS SCHEDULER',
    runBoxTitle: 'ALL-SHEETS RUN',
    catchUpBoxTitle: 'SCHEDULER CATCH-UP',
    logPrefix: 'SCHED',
    statePathEnvName: 'SCHEDULER_STATE_PATH',
    defaultStateFile: '.scheduler-state.all-sheets.json',
    getRunScheduleConfig,
    runWorkflow: runAllSheetsWorkflow,
  });
};

startScheduler().catch((error) => {
  logger.error(`스케줄러 오류: ${(error as Error).message}`);
  process.exit(1);
});
