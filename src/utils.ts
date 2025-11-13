export const getSearchQuery = (query: string): string => {
  // Strip any content inside parentheses for search; collapse spaces
  try {
    return String(query ?? '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return String(query ?? '').trim();
  }
};

