import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import os from 'os';
import { main as runCrawl } from './index';
import { requests, importRes } from './constants';
import { syncKeywords, importKeywords } from './api';
import { logger } from './lib/logger';

dotenv.config();

async function runCrawlingJob() {
  await runCrawl();
}

const formatDuration = (ms: number): string => {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min > 0) return `${min}분 ${sec % 60}초`;
  return `${sec}초`;
};

async function runFullWorkflow() {
  const startTime = new Date();

  logger.summary.start('CRON JOB START', [
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

    logger.summary.complete('CRON JOB COMPLETE', [
      { label: '완료', value: endTime.toLocaleString('ko-KR') },
      { label: '소요', value: formatDuration(duration) },
      { label: '총 업데이트', value: `${totalUpdated}건` },
    ]);
  } catch (error) {
    const endTime = new Date();
    const errMsg = axios.isAxiosError(error)
      ? `API 오류: ${error.response?.status || 'N/A'}`
      : (error as Error).message;

    logger.summary.error('CRON JOB FAILED', [
      { label: '시간', value: endTime.toLocaleString('ko-KR') },
      { label: '오류', value: errMsg.slice(0, 40) },
    ]);

    if (axios.isAxiosError(error) && error.response) {
      logger.error(`상세: ${JSON.stringify(error.response.data)}`);
    }

    throw error;
  }
}

let cronSchedule: string;
let scheduleDescription: string;

const testDelayMinutes = Number(process.env.TEST_DELAY_MINUTES || '0');

if (testDelayMinutes > 0) {
  const now = new Date();
  const targetTime = new Date(now.getTime() + testDelayMinutes * 60 * 1000);
  const minute = targetTime.getMinutes();
  const hour = targetTime.getHours();

  cronSchedule = `${minute} ${hour} * * *`;
  scheduleDescription = `테스트 모드: ${testDelayMinutes}분 뒤 (${targetTime.toLocaleTimeString(
    'ko-KR',
    { hour: '2-digit', minute: '2-digit' }
  )})`;
} else {
  cronSchedule = '01 09 * * *';
  scheduleDescription = '매일 오전 9시 10분';
}

const startupItems = [
  { label: 'OS', value: `${os.platform()} ${os.arch()} (${os.release()})` },
  { label: '스케줄', value: cronSchedule },
  { label: '모드', value: scheduleDescription },
  { label: '현재', value: new Date().toLocaleString('ko-KR') },
];

if (testDelayMinutes > 0) {
  const targetTime = new Date(Date.now() + testDelayMinutes * 60 * 1000);
  startupItems.push({
    label: '실행 예정',
    value: targetTime.toLocaleTimeString('ko-KR'),
  });
}

logger.summary.start('CRON SCHEDULER', startupItems);
logger.info('⏳ 대기 중...');

cron.schedule(
  cronSchedule,
  () => {
    runFullWorkflow();
  },
  {
    timezone: 'Asia/Seoul',
  }
);
