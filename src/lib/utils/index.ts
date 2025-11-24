export const formatDuration = (ms: number): string => {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min > 0) return `${min}분 ${sec % 60}초`;
  return `${sec}초`;
};

export const formatTime = (date: Date): string => {
  return date.toLocaleString('ko-KR');
};

export const formatTimeShort = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
