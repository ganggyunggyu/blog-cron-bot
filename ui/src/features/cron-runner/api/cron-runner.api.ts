export type CronMode = 'cron-test' | 'cron-root' | 'cron-pet';

export const getCronStreamUrl = (baseUrl: string, mode: CronMode) => {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  const url = trimmed ? trimmed : window.location.origin;
  const params = new URLSearchParams({ mode });
  return `${url}/api/cron/stream?${params.toString()}`;
};
