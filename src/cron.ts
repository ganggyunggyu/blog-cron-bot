import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import os from 'os';
import { main as runCrawl } from './index';
import { requests, importRes } from './constants';
import { syncKeywords, importKeywords } from './api';

dotenv.config();

async function runCrawlingJob() {
  await runCrawl();
}

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
  step: (
    num: number,
    total: number,
    msg: string,
    status: 'start' | 'done' = 'start'
  ) => {
    const icon = status === 'done' ? '✓' : '▶';
    console.log(`  ${icon} [${num}/${total}] ${msg}`);
  },
  result: (label: string, count: number) => {
    console.log(`     └─ ${label}: ${count}건`);
  },
};

const formatDuration = (ms: number): string => {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min > 0) return `${min}분 ${sec % 60}초`;
  return `${sec}초`;
};

async function runFullWorkflow() {
  const startTime = new Date();

  log.box('CRON JOB START', [
    `시작: ${startTime.toLocaleString('ko-KR')}`,
    `OS: ${os.platform()} (${os.arch()})`,
  ]);

  try {
    log.step(1, 3, 'DB 동기화');
    await syncKeywords(requests[0]);
    await syncKeywords(requests[1]);
    await syncKeywords(requests[2]);
    log.step(1, 3, 'DB 동기화', 'done');

    log.step(2, 3, '노출 체크');
    await runCrawlingJob();
    log.step(2, 3, '노출 체크', 'done');

    log.step(3, 3, '시트 반영');
    const packageImportRes = await importKeywords(importRes[0]);
    log.result('패키지', packageImportRes.updated || 0);

    const dogExImportRes = await importKeywords(importRes[1]);
    log.result('일반건', dogExImportRes.updated || 0);

    const dogmaruImportRes = await importKeywords(importRes[2]);
    log.result('도그마루', dogmaruImportRes.updated || 0);
    log.step(3, 3, '시트 반영', 'done');

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    log.box('CRON JOB COMPLETE', [
      `완료: ${endTime.toLocaleString('ko-KR')}`,
      `소요: ${formatDuration(duration)}`,
      `총 업데이트: ${
        (packageImportRes.updated || 0) +
        (dogExImportRes.updated || 0) +
        (dogmaruImportRes.updated || 0)
      }건`,
    ]);
  } catch (error) {
    const endTime = new Date();
    const errMsg = axios.isAxiosError(error)
      ? `API 오류: ${error.response?.status || 'N/A'}`
      : (error as Error).message;

    log.box('CRON JOB FAILED', [
      `시간: ${endTime.toLocaleString('ko-KR')}`,
      `오류: ${errMsg.slice(0, 45)}`,
    ]);

    if (axios.isAxiosError(error) && error.response) {
      console.error('  상세:', error.response.data);
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
  cronSchedule = '50 12 * * *';
  scheduleDescription = '매일 오전 9시 10분';
}

const startupInfo = [
  `OS: ${os.platform()} ${os.arch()} (${os.release()})`,
  `스케줄: ${cronSchedule}`,
  `모드: ${scheduleDescription}`,
  `현재: ${new Date().toLocaleString('ko-KR')}`,
];

if (testDelayMinutes > 0) {
  const targetTime = new Date(Date.now() + testDelayMinutes * 60 * 1000);
  startupInfo.push(`실행 예정: ${targetTime.toLocaleTimeString('ko-KR')}`);
}

log.box('CRON SCHEDULER', startupInfo);
console.log('\n  ⏳ 대기 중...\n');

cron.schedule(
  cronSchedule,
  () => {
    runFullWorkflow();
  },
  {
    timezone: 'Asia/Seoul',
  }
);
