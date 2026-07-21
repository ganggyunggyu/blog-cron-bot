import fs from 'node:fs';
import path from 'node:path';

export interface RunLogTail {
  readAvailable: () => void;
  close: () => void;
}

export const prepareRunLogFile = (logPath: string): number => {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, '');
  return fs.openSync(logPath, 'a');
};

export const createRunLogTail = (
  logPath: string,
  onChunk: (chunk: Buffer) => void,
): RunLogTail => {
  let offset = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  let isClosed = false;

  const readAvailable = () => {
    if (isClosed || !fs.existsSync(logPath)) return;
    const size = fs.statSync(logPath).size;
    if (size < offset) offset = 0;
    if (size === offset) return;

    const fileDescriptor = fs.openSync(logPath, 'r');
    try {
      const chunk = Buffer.alloc(size - offset);
      fs.readSync(fileDescriptor, chunk, 0, chunk.length, offset);
      offset = size;
      onChunk(chunk);
    } finally {
      fs.closeSync(fileDescriptor);
    }
  };

  fs.watchFile(logPath, { interval: 250, persistent: false }, readAvailable);
  readAvailable();

  return {
    readAvailable,
    close: () => {
      if (isClosed) return;
      readAvailable();
      isClosed = true;
      fs.unwatchFile(logPath, readAvailable);
    },
  };
};
