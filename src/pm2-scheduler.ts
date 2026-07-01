import axios from 'axios';
import dotenv from 'dotenv';
import os from 'os';
import { importKeywords, syncKeywords } from './api';
import { importRes, requests } from './constants';
import {
  parseTimeList,
  SCHEDULER_STATE_FILE,
  WORKFLOW_RUN_TIME_LIST,
} from './constants/scheduler';
import { main as runCrawl } from './index';
import { formatDuration } from './lib';
import { logger } from './lib/logger';
import {
  getTestDelayRunScheduleConfig,
  type RunScheduleConfig,
  startScheduledWorkflow,
} from './lib/scheduler-runner';

dotenv.config();

const runCrawlingJob = async (): Promise<void> => {
  await runCrawl();
};

const runFullWorkflow = async (): Promise<void> => {
  const startTime = new Date();

  logger.summary.start('WORKFLOW START', [
    { label: '시작', value: startTime.toLocaleString('ko-KR') },
    { label: 'OS', value: `${os.platform()} (${os.arch()})` },
  ]);

  try {
    logger.step(1, 3, 'DB 동기화');
    await syncKeywords(requests[0]);
    await syncKeywords(requests[1]);
    await syncKeywords(requests[2]);
    logger.step(1, 3, 'DB 동기화', 'done');

    logger.step(2, 3, '노출 체크');
    await runCrawlingJob();
    logger.step(2, 3, '노출 체크', 'done');

    logger.step(3, 3, '시트 반영');
    const packageImportRes = await importKeywords(importRes[0]);
    logger.result('패키지', `${packageImportRes.updated || 0}건`);

    const dogExImportRes = await importKeywords(importRes[1]);
    logger.result('일반건', `${dogExImportRes.updated || 0}건`);

    const dogmaruImportRes = await importKeywords(importRes[2]);
    logger.result('도그마루', `${dogmaruImportRes.updated || 0}건`);
    logger.step(3, 3, '시트 반영', 'done');

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const totalUpdated =
      (packageImportRes.updated || 0) +
      (dogExImportRes.updated || 0) +
      (dogmaruImportRes.updated || 0);

    logger.summary.complete('WORKFLOW COMPLETE', [
      { label: '완료', value: endTime.toLocaleString('ko-KR') },
      { label: '소요', value: formatDuration(duration) },
      { label: '총 업데이트', value: `${totalUpdated}건` },
    ]);
  } catch (error) {
    const endTime = new Date();
    const errMsg = axios.isAxiosError(error)
      ? `API 오류: ${error.response?.status || 'N/A'}`
      : (error as Error).message;

    logger.summary.error('WORKFLOW FAILED', [
      { label: '시간', value: endTime.toLocaleString('ko-KR') },
      { label: '오류', value: errMsg.slice(0, 40) },
    ]);

    if (axios.isAxiosError(error) && error.response) {
      logger.error(`상세: ${JSON.stringify(error.response.data)}`);
    }

    throw error;
  }
};

const getRunScheduleConfig = (): RunScheduleConfig => {
  const testConfig = getTestDelayRunScheduleConfig();
  if (testConfig) return testConfig;

  const envTimeList = parseTimeList(String(process.env.WORKFLOW_RUN_TIMES || ''));
  if (envTimeList.length > 0) {
    return {
      runTimeList: envTimeList,
      scheduleDescription: `WORKFLOW_RUN_TIMES=${envTimeList.join(',')}`,
    };
  }

  return {
    runTimeList: [...WORKFLOW_RUN_TIME_LIST],
    scheduleDescription: `DEFAULT=${WORKFLOW_RUN_TIME_LIST.join(',')}`,
  };
};

const startScheduler = async (): Promise<void> => {
  await startScheduledWorkflow({
    schedulerTitle: 'PM2 SCHEDULER',
    runBoxTitle: 'WORKFLOW RUN',
    catchUpBoxTitle: 'SCHEDULER CATCH-UP',
    logPrefix: 'SCHED',
    statePathEnvName: 'SCHEDULER_STATE_PATH',
    defaultStateFile: SCHEDULER_STATE_FILE,
    getRunScheduleConfig,
    runWorkflow: runFullWorkflow,
  });
};

startScheduler().catch((error) => {
  logger.error(`스케줄러 오류: ${(error as Error).message}`);
  process.exit(1);
});
