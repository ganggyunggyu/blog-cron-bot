export interface DaemonStatus {
  name: string;
  status: string;
  pid: number | null;
  uptimeMs: number | null;
  memoryBytes: number | null;
  cpuPercent: number | null;
  restarts: number | null;
}

export type DaemonAction = 'start' | 'stop' | 'restart';
