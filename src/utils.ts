export const getKSTTimestamp = (): string => {
  const now = new Date();
  const kst = now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
  return kst.replace(/[: ]/g, '-');
};

export const getSearchQuery = (query: string): string => {
  try {
    return String(query ?? '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return String(query ?? '').trim();
  }
};
