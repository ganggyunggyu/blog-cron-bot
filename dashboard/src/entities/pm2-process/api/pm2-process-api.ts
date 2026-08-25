import axios from 'axios';
import { api } from '@/shared';
import type { DaemonAction, DaemonStatus } from '../model/types';

interface ErrorResponse {
  error?: string;
}

/**
 * axios가 던지는 에러도 Error라서, 화면에서 error.message를 그냥 쓰면
 * "Request failed with status code 502" 같은 영어 원문이 그대로 보인다.
 * 서버가 준 한글 메시지를 먼저 꺼내고, 없을 때만 우리 문구로 대체한다.
 */
const toDaemonError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    return new Error(error.response?.data?.error ?? fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
};

export const getDaemonStatusList = async () => {
  try {
    const { data } = await api.get<{ daemons: DaemonStatus[] }>('/pm2');
    return data.daemons;
  } catch (error) {
    throw toDaemonError(error, '스케줄러 상태를 불러오지 못함');
  }
};

export const runDaemonAction = async (name: string, action: DaemonAction) => {
  try {
    const { data } = await api.post<{ ok: boolean }>(`/pm2/${name}/${action}`);
    return data;
  } catch (error) {
    throw toDaemonError(error, '스케줄러를 제어하지 못함');
  }
};
