export { formatDuration } from '@ganggyunggyu/shared';

export const formatTime = (date: Date): string => {
  return date.toLocaleString('ko-KR');
};

export const formatTimeShort = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
