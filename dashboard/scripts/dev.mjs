import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const dashboardDirectory = path.resolve(scriptDirectory, '..');
const projectDirectory = path.resolve(dashboardDirectory, '..');
const rootEnvironment = parse(
  readFileSync(path.join(projectDirectory, '.env')),
);

const environment = { ...process.env };
['MONGODB_URI', 'DASHBOARD_SESSION_SECRET'].forEach((key) => {
  const value = rootEnvironment[key];
  if (value) environment[key] = value;
});

const nextBinary = path.join(
  dashboardDirectory,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);
const child = spawn(
  process.execPath,
  [nextBinary, 'dev', dashboardDirectory, '--port', '4500'],
  {
    cwd: dashboardDirectory,
    env: environment,
    stdio: 'inherit',
  },
);

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.once(signal, () => child.kill(signal));
});

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
