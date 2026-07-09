export const formatUptime = (ms: number | null) => {
  if (ms === null || ms < 0) return '-';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
};

export const formatBytes = (bytes: number | null) => {
  if (bytes === null) return '-';
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1)}MB`;
};

export const formatDateTime = (isoString: string | null) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
};
