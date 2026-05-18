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

const DOORAY_WEBHOOK_URL = process.env.DOORAY_WEBHOOK_URL;
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

// ── 비교 헬퍼 ──

const diffIndicator = (current: number, previous: number | undefined): string => {
  if (previous === undefined) return '';
  const diff = current - previous;
  if (diff > 0) return ` ▲ +${diff}`;
  if (diff < 0) return ` ▼ ${diff}`;
  return ' ─';
};

const formatRate = (count: number, total: number): string => {
  if (total === 0) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
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
  if (!DOORAY_WEBHOOK_URL) {
    logger.warn('DOORAY_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
    return false;
  }

  try {
    const message: DoorayWebhookMessage = {
      botName,
      text,
    };

    await axios.post(DOORAY_WEBHOOK_URL, message);
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

  const exposureRate = formatRate(exposureCount, totalKeywords);
  const displayName = cronType.replace(/^멀티페이지 크론 /, '').replace(/^\[|\]$/g, '');

  const prev = loadSnapshots()[cronType];
  const expDiff = diffIndicator(exposureCount, prev?.exposureCount);

  let text = '';
  text += `[${displayName}] ${getKSTDateString()}\n`;
  text += `노출 ${exposureCount}/${totalKeywords} (${exposureRate})${expDiff} | 소요 ${elapsedTime}\n`;

  if (exposureCount > 0) {
    const popDiff = diffIndicator(popularCount, prev?.popularCount);
    const sblDiff = diffIndicator(sblCount, prev?.sblCount);
    text += `인기 ${popularCount}${popDiff} | 스블 ${sblCount}${sblDiff}`;

    if (typeof newLogicCount === 'number' && typeof oldLogicCount === 'number') {
      const newDiff = diffIndicator(newLogicCount, prev?.newLogicCount);
      const oldDiff = diffIndicator(oldLogicCount, prev?.oldLogicCount);
      text += ` | 신규 ${newLogicCount}${newDiff} | 구 ${oldLogicCount}${oldDiff}`;
    }
    text += `\n`;

    if (sheetStats && sheetStats.length > 0) {
      const statParts = sheetStats.map((stat) => {
        const prevStat = prev?.sheetStats?.find((s) => s.name === stat.name);
        const statDiff = diffIndicator(stat.count, prevStat?.count);
        return `${stat.name} ${stat.count}${statDiff}`;
      });
      text += `시트별: ${statParts.join(' | ')}\n`;
    }
  }

  if (prev && exposureCount !== prev.exposureCount) {
    const totalDiff = exposureCount - prev.exposureCount;
    const sign = totalDiff > 0 ? '+' : '';
    text += `전회 대비: ${prev.exposureCount} → ${exposureCount} (${sign}${totalDiff})\n`;
  }

  if (exposureCount > 0 && missingKeywords && missingKeywords.length > 0) {
    const showCount = Math.min(missingKeywords.length, 5);
    const remaining = missingKeywords.length - showCount;
    text += `\n미노출 ${missingKeywords.length}건: ${missingKeywords.slice(0, showCount).join(', ')}`;
    if (remaining > 0) text += ` 외 ${remaining}건`;
    text += `\n`;
  }

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
