import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface DoorayWebhookMessage {
  botName: string;
  botIconImage?: string;
  text: string;
  attachments?: DoorayAttachment[];
}

interface DoorayAttachment {
  title?: string;
  titleLink?: string;
  text?: string;
  color?: string;
}

interface ExposureSnapshot {
  cronType: string;
  totalKeywords: number;
  exposureCount: number;
  popularCount: number;
  sblCount: number;
  newLogicCount?: number;
  oldLogicCount?: number;
  sheetStats?: { name: string; count: number }[];
  timestamp: string;
}

const SNAPSHOT_DIR = path.resolve(__dirname, '../../data');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'last-exposure-results.json');

// ── 스냅샷 저장/로드 ──

const loadSnapshots = (): Record<string, ExposureSnapshot> => {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
    }
  } catch {
    logger.warn('이전 노출 스냅샷 로드 실패, 새로 시작합니다.');
  }
  return {};
};

const saveSnapshot = (key: string, snapshot: ExposureSnapshot): void => {
  try {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
      fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }
    const all = loadSnapshots();
    all[key] = snapshot;
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (error) {
    logger.warn(`스냅샷 저장 실패: ${(error as Error).message}`);
  }
};

const getKSTDateString = (): string => {
  const now = new Date();
  return now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ── 메시지 전송 ──

export const sendDoorayMessage = async (
  text: string,
  botName: string = '노출체크봇'
): Promise<boolean> => {
  const doorayWebhookUrl = process.env.DOORAY_WEBHOOK_URL;

  if (!doorayWebhookUrl) {
    logger.warn('DOORAY_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
    return false;
  }

  try {
    const message: DoorayWebhookMessage = {
      botName,
      text,
    };

    await axios.post(doorayWebhookUrl, message);
    return true;
  } catch (error) {
    logger.error(`Dooray 메시지 전송 실패: ${(error as Error).message}`);
    return false;
  }
};

export const sendDoorayExposureResult = async (params: {
  cronType: string;
  totalKeywords: number;
  exposureCount: number;
  popularCount: number;
  sblCount: number;
  elapsedTime: string;
  sheetStats?: { name: string; count: number }[];
  missingKeywords?: string[];
  newLogicCount?: number;
  oldLogicCount?: number;
}): Promise<boolean> => {
  const {
    cronType,
    totalKeywords,
    exposureCount,
    popularCount,
    sblCount,
    elapsedTime,
    sheetStats,
    missingKeywords,
    newLogicCount,
    oldLogicCount,
  } = params;

  const displayName = cronType.replace(/^멀티페이지 크론 /, '').replace(/^\[|\]$/g, '');
  const missingCount = totalKeywords - exposureCount;
  const text =
    `[${displayName}] ${getKSTDateString()}\n` +
    `노출 ${exposureCount}개 / 미노출 ${missingCount}개`;

  const result = await sendDoorayMessage(text);

  // 현재 결과 스냅샷 저장
  saveSnapshot(cronType, {
    cronType,
    totalKeywords,
    exposureCount,
    popularCount,
    sblCount,
    newLogicCount,
    oldLogicCount,
    sheetStats,
    timestamp: new Date().toISOString(),
  });

  return result;
};
