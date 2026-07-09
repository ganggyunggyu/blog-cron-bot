import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from './paths';

export interface OutputFileEntry {
  relativePath: string;
  fileName: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface OutputFileListResult {
  files: OutputFileEntry[];
  totalCount: number;
}

const MAX_LISTED_FILES = 200;

const walk = (dir: string, baseDir: string, results: OutputFileEntry[]) => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, baseDir, results);
      return;
    }
    if (!entry.isFile()) return;

    const stat = fs.statSync(fullPath);
    results.push({
      relativePath: path.relative(baseDir, fullPath),
      fileName: entry.name,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  });
};

export const listOutputFiles = (): OutputFileListResult => {
  const results: OutputFileEntry[] = [];
  walk(OUTPUT_DIR, OUTPUT_DIR, results);
  results.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  return { files: results.slice(0, MAX_LISTED_FILES), totalCount: results.length };
};

export const resolveOutputFilePath = (relativePath: string): string | null => {
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return null;
  }

  const resolvedRoot = path.resolve(OUTPUT_DIR);
  const resolvedTarget = path.resolve(resolvedRoot, normalized);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  if (!fs.existsSync(resolvedTarget) || !fs.statSync(resolvedTarget).isFile()) {
    return null;
  }
  return resolvedTarget;
};
