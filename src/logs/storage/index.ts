import * as fs from 'fs';
import * as path from 'path';
import { formatDetailedLogs } from '../formatter';
import { DetailedLog } from '../../types';

export function saveDetailedLogs(
  logs: DetailedLog[],
  timestamp: string,
  elapsedTimeStr: string
): void {
  const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // JSON 저장
  const jsonPath = path.join(logsDir, `detailed-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(logs, null, 2), 'utf-8');
  console.log(`\n📄 JSON 로그 저장: ${jsonPath}`);

  // TXT 저장
  const txtPath = path.join(logsDir, `detailed-${timestamp}.txt`);
  const formattedLog = formatDetailedLogs(logs, elapsedTimeStr);
  fs.writeFileSync(txtPath, formattedLog, 'utf-8');
  console.log(`📄 TXT 로그 저장: ${txtPath}`);
}
