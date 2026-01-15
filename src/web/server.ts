import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

const app = express();
const server = createServer(app);
const io = new Server(server);

let runningProcess: ChildProcess | null = null;
let currentJob: string | null = null;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.emit('status', {
    running: !!runningProcess,
    job: currentJob,
  });

  socket.on('start', (jobType: string) => {
    if (runningProcess) {
      socket.emit('error', '이미 실행 중인 작업이 있습니다.');
      return;
    }

    const scriptMap: Record<string, string> = {
      test: 'cron:test',
      pet: 'cron:pet',
      root: 'cron:root',
    };

    const script = scriptMap[jobType];
    if (!script) {
      socket.emit('error', '알 수 없는 작업 유형입니다.');
      return;
    }

    currentJob = jobType;
    io.emit('status', { running: true, job: currentJob });
    io.emit('log', `\n========== ${jobType.toUpperCase()} 크론 시작 ==========\n`);

    runningProcess = spawn('pnpm', [script], {
      cwd: path.join(__dirname, '../..'),
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    runningProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      io.emit('log', text);
    });

    runningProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      io.emit('log', text);
    });

    runningProcess.on('close', (code) => {
      io.emit('log', `\n========== 작업 완료 (코드: ${code}) ==========\n`);
      io.emit('status', { running: false, job: null });
      io.emit('done', { job: currentJob, code });
      runningProcess = null;
      currentJob = null;
    });

    runningProcess.on('error', (err) => {
      io.emit('error', `프로세스 에러: ${err.message}`);
      runningProcess = null;
      currentJob = null;
      io.emit('status', { running: false, job: null });
    });
  });

  socket.on('stop', () => {
    if (runningProcess) {
      runningProcess.kill('SIGTERM');
      io.emit('log', '\n⚠️ 작업이 중단되었습니다.\n');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 크론 대시보드 실행 중: http://localhost:${PORT}`);
});
