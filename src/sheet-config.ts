export interface SheetOptions {
  allowAnyBlog?: boolean;

  maxContentChecks?: number;

  contentCheckDelayMs?: number;

  csvFilePrefix?: string;
}

const DEFAULT_OPTIONS: Required<SheetOptions> = {
  allowAnyBlog: false,
  maxContentChecks: 3,
  contentCheckDelayMs: 600,
  csvFilePrefix: 'results',
};

export const normalizeSheetType = (v: unknown): string =>
  String(v ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();

const ALIASES: Record<string, string> = {
  dogmaru: 'dogmaru',
  도그마루: 'dogmaru',
  package: 'package',
};

const SHEET_OPTIONS: Record<string, SheetOptions> = {
  package: {
    allowAnyBlog: false,
    maxContentChecks: 3,
    contentCheckDelayMs: 600,
    csvFilePrefix: 'results-package',
  },

  dogmaru: {
    allowAnyBlog: false,
    maxContentChecks: 4,
    contentCheckDelayMs: 500,
    csvFilePrefix: 'results-dogmaru',
  },
};

export const getSheetOptions = (
  sheetType?: string | null
): Required<SheetOptions> => {
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
