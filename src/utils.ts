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
