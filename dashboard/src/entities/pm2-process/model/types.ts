export interface DaemonStatus {
  name: string;
  status: string;
  pid: number | null;
  uptimeMs: number | null;
  memoryBytes: number | null;
  cpuPercent: number | null;
  restarts: number | null;
  /** pm2에 등록된 cron 표현식. 자동 실행이 없으면 null. */
  cronRestart: string | null;
}

export type DaemonAction = 'start' | 'stop' | 'restart';
