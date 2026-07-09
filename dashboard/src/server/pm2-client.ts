import pm2 from 'pm2';
import type { ProcessDescription } from 'pm2';

export const DAEMON_APP_NAMES = [
  'blog-cron-bot-keywords',
  'blog-cron-bot-root',
  'blog-cron-bot-all-sheets',
] as const;

export type DaemonAppName = (typeof DAEMON_APP_NAMES)[number];
export type DaemonAction = 'start' | 'stop' | 'restart';

export interface DaemonStatus {
  name: string;
  status: string;
  pid: number | null;
  uptimeMs: number | null;
  memoryBytes: number | null;
  cpuPercent: number | null;
  restarts: number | null;
}

export const isControllableDaemon = (name: string): name is DaemonAppName =>
  (DAEMON_APP_NAMES as readonly string[]).includes(name);

const connect = () =>
  new Promise<void>((resolve, reject) => {
    pm2.connect((err) => (err ? reject(err) : resolve()));
  });

const disconnect = () => pm2.disconnect();

const listAll = () =>
  new Promise<ProcessDescription[]>((resolve, reject) => {
    pm2.list((err, list) => (err ? reject(err) : resolve(list)));
  });

const toDaemonStatus = (name: string, proc: ProcessDescription | undefined): DaemonStatus => {
  if (!proc) {
    return {
      name,
      status: 'not_found',
      pid: null,
      uptimeMs: null,
      memoryBytes: null,
      cpuPercent: null,
      restarts: null,
    };
  }

  const uptimeStart = proc.pm2_env?.pm_uptime;
  const isRunning = proc.pm2_env?.status === 'online';

  return {
    name,
    status: proc.pm2_env?.status ?? 'unknown',
    pid: proc.pid ?? null,
    uptimeMs: isRunning && uptimeStart ? Date.now() - uptimeStart : null,
    memoryBytes: proc.monit?.memory ?? null,
    cpuPercent: proc.monit?.cpu ?? null,
    restarts: proc.pm2_env?.restart_time ?? null,
  };
};

export const getDaemonStatuses = async (): Promise<DaemonStatus[]> => {
  await connect();
  try {
    const list = await listAll();
    const byName = new Map(list.map((proc) => [proc.name, proc]));
    return DAEMON_APP_NAMES.map((name) => toDaemonStatus(name, byName.get(name)));
  } finally {
    disconnect();
  }
};

export const controlDaemon = async (name: DaemonAppName, action: DaemonAction) => {
  await connect();
  try {
    await new Promise<void>((resolve, reject) => {
      const callback = (err: Error | null) => (err ? reject(err) : resolve());
      if (action === 'start') {
        pm2.start(name, callback);
        return;
      }
      if (action === 'stop') {
        pm2.stop(name, callback);
        return;
      }
      pm2.restart(name, callback);
    });
  } finally {
    disconnect();
  }
};
