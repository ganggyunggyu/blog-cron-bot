import path from 'node:path';

export const REPO_ROOT = path.resolve(process.cwd(), '..');
export const REPO_ENV_PATH = path.join(REPO_ROOT, '.env');
export const OUTPUT_DIR = process.env.OUTPUT_ROOT_DIR || path.join(REPO_ROOT, 'output');
export const EXPOSURE_SUITE_LOCK_PATH = path.join(REPO_ROOT, 'work', 'exposure-suite.lock');

const DASHBOARD_DATA_ROOT = process.env.DASHBOARD_DATA_ROOT
  || (process.env.OUTPUT_ROOT_DIR ? path.dirname(OUTPUT_DIR) : path.join(REPO_ROOT, 'work'));

export const DASHBOARD_RUN_STATE_PATH = process.env.DASHBOARD_RUN_STATE_PATH
  || path.join(DASHBOARD_DATA_ROOT, 'dashboard-runs.json');
export const DASHBOARD_RUN_LOG_DIR = process.env.DASHBOARD_RUN_LOG_DIR
  || path.join(DASHBOARD_DATA_ROOT, 'dashboard-runs');
