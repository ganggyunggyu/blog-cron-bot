import axios from 'axios';
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

const DOORAY_WEBHOOK_URL = process.env.DOORAY_WEBHOOK_URL;

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
    newLogicCount,
    oldLogicCount,
  } = params;

  const nonExposedCount = totalKeywords - exposureCount;

  let text = `${cronType}\n`;
  text += `노출 ${exposureCount} / 미노출 ${nonExposedCount}\n`;

  if (typeof newLogicCount === 'number' && typeof oldLogicCount === 'number') {
    text += `신규로직 ${newLogicCount} / 구로직 ${oldLogicCount}\n`;
  }

  text += `소요시간: ${elapsedTime}\n`;

  if (sheetStats && sheetStats.length > 0) {
    text += `\n[시트별]\n`;
    for (const stat of sheetStats) {
      text += `${stat.name}: ${stat.count}\n`;
    }
  }

  return sendDoorayMessage(text);
};
