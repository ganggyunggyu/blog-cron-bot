import path from 'node:path';

export const REPO_ROOT = path.resolve(process.cwd(), '..');
export const REPO_ENV_PATH = path.join(REPO_ROOT, '.env');
export const OUTPUT_DIR = path.join(REPO_ROOT, 'output');
