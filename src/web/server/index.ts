import express from 'express';
import path from 'path';
import fs from 'fs';
import bodyParser from 'body-parser';
import { testKeyword } from '../tester';
import { runBatch } from '../batch-runner';
import { getCronStatus, streamCronRun } from '../cron-runner';
import { checkNewLogic } from '../../lib/check-new-logic';
import { connectDB, disconnectDB } from '../../database';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5178);

const isCronMode = (
  value: string
): value is 'cron-test' | 'cron-root' | 'cron-pages' => {
  return value === 'cron-test' || value === 'cron-root' || value === 'cron-pages';
};

app.use(bodyParser.json({ limit: '1mb' }));

// CORS 설정
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const uiDistDir = path.join(__dirname, '../../../ui/dist');
const publicDir = path.join(__dirname, '../../../public');
const staticDir = fs.existsSync(uiDistDir) ? uiDistDir : publicDir;

app.use(express.static(staticDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/cron/status', (_req, res) => {
  res.json({ ok: true, ...getCronStatus() });
});

app.get('/api/cron/stream', (req, res) => {
  const modeRaw = String(req.query.mode || '');
  const mode = isCronMode(modeRaw) ? modeRaw : null;

  if (!mode) {
    res.status(400).json({ ok: false, error: 'invalid mode' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const status = getCronStatus();
  if (status.running) {
    res.write(`event: status\n`);
    res.write(`data: ${JSON.stringify({ status: 'busy', mode: status.mode })}\n\n`);
    res.end();
    return;
  }

  streamCronRun(mode, res);
});

app.post('/api/test', async (req, res) => {
  try {
    const {
      keyword,
      allowAnyBlog = false,
      fetchHtml = false,
      maxContentChecks,
      contentCheckDelay,
    } = req.body || {};
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({ ok: false, error: 'keyword is required' });
    }
    const result = await testKeyword(
      { keyword },
      { allowAnyBlog, fetchHtml, maxContentChecks, contentCheckDelay }
    );
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  }
});

app.post('/api/check-logic', async (req, res) => {
  try {
    const { keyword } = req.body || {};
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({ ok: false, error: 'keyword is required' });
    }
    const result = await checkNewLogic(keyword);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  }
});

app.get('/batch', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.post('/api/run', async (req, res) => {
  const {
    startIndex = 0,
    limit = 5,
    onlySheetType = '',
    onlyCompany = '',
    onlyKeywordRegex = '',
    onlyId = '',
    onlyIds = [],
    allowAnyBlog = false,
    maxContentChecks = 3,
    contentCheckDelay = 600,
  } = req.body || {};
  const uri = process.env.MONGODB_URI;
  if (!uri) return res.status(500).json({ ok: false, error: 'MONGODB_URI not set' });
  try {
    await connectDB(uri);
    const result = await runBatch({
      startIndex: Number(startIndex),
      limit: Number(limit),
      onlySheetType,
      onlyCompany,
      onlyKeywordRegex,
      onlyId: String(onlyId || ''),
      onlyIds: Array.isArray(onlyIds) ? onlyIds : [],
      allowAnyBlog: !!allowAnyBlog,
      maxContentChecks: Number(maxContentChecks),
      contentCheckDelay: Number(contentCheckDelay),
    });
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  } finally {
    await disconnectDB();
  }
});

app.listen(PORT, () => {
  console.log(`UI server listening on http://localhost:${PORT}`);
});

export { app };
