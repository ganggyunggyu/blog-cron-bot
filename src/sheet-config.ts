// Sheet-type specific behavior configuration
// Keep this small and explicit; env vars can still override.

export interface SheetOptions {
  // If true, accept any blog ID (ignore whitelist)
  allowAnyBlog?: boolean;
  // How many candidate posts to fetch for vendor check
  maxContentChecks?: number;
  // Delay between content fetches (ms)
  contentCheckDelayMs?: number;
  // Optional CSV file prefix for runs
  csvFilePrefix?: string;
}

const DEFAULT_OPTIONS: Required<SheetOptions> = {
  allowAnyBlog: false,
  maxContentChecks: 3,
  contentCheckDelayMs: 600,
  csvFilePrefix: 'results',
};

// Normalize sheet type key: lowercased, no spaces, ASCII if possible.
export const normalizeSheetType = (v: unknown): string =>
  String(v ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();

// Known aliases mapped to canonical keys
const ALIASES: Record<string, string> = {
  dogmaru: 'dogmaru',
  '도그마루': 'dogmaru',
  package: 'package',
};

const SHEET_OPTIONS: Record<string, SheetOptions> = {
  // Default "package" behavior stays conservative
  package: {
    allowAnyBlog: false,
    maxContentChecks: 3,
    contentCheckDelayMs: 600,
    csvFilePrefix: 'results-package',
  },
  // Dogmaru: enable slightly more permissive matching by default
  dogmaru: {
    allowAnyBlog: true,
    maxContentChecks: 4,
    contentCheckDelayMs: 500,
    csvFilePrefix: 'results-dogmaru',
  },
};

export const getSheetOptions = (sheetType?: string | null): Required<SheetOptions> => {
  const keyRaw = sheetType ?? '';
  const norm = normalizeSheetType(keyRaw);
  const canonical = ALIASES[norm] || norm;
  const opts = SHEET_OPTIONS[canonical] || {};
  return {
    allowAnyBlog: opts.allowAnyBlog ?? DEFAULT_OPTIONS.allowAnyBlog,
    maxContentChecks: opts.maxContentChecks ?? DEFAULT_OPTIONS.maxContentChecks,
    contentCheckDelayMs:
      opts.contentCheckDelayMs ?? DEFAULT_OPTIONS.contentCheckDelayMs,
    csvFilePrefix: opts.csvFilePrefix ?? DEFAULT_OPTIONS.csvFilePrefix,
  };
};

