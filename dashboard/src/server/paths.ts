import path from 'node:path';

export const REPO_ROOT = path.resolve(process.cwd(), '..');
export const REPO_ENV_PATH = path.join(REPO_ROOT, '.env');
export const OUTPUT_DIR = process.env.OUTPUT_ROOT_DIR || path.join(REPO_ROOT, 'output');
export const EXPOSURE_SUITE_LOCK_PATH = path.join(REPO_ROOT, 'work', 'exposure-suite.lock');
