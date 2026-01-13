export const getKSTTimestamp = (): string => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
