import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import { testKeyword } from './tester';
import { runBatch } from './batch_runner';
import { connectDB, disconnectDB } from '../database';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5178);

app.use(bodyParser.json({ limit: '1mb' }));

// Static UI
const publicDir = path.join(__dirname, '../../public');
app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/test', async (req, res) => {
  try {
    const { keyword, allowAnyBlog = false, fetchHtml = false } = req.body || {};
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({ ok: false, error: 'keyword is required' });
    }
    const result = await testKeyword({ keyword }, { allowAnyBlog, fetchHtml });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  }
});

app.get('/batch', (_req, res) => {
  res.sendFile(path.join(publicDir, 'batch.html'));
});

app.post('/api/run', async (req, res) => {
  const { startIndex = 0, limit = 5, onlySheetType = '', onlyCompany = '', onlyKeywordRegex = '', allowAnyBlog = false, maxContentChecks = 3, contentCheckDelay = 600 } = req.body || {};
  const uri = process.env.MONGODB_URI;
  if (!uri) return res.status(500).json({ ok: false, error: 'MONGODB_URI not set' });
  try {
    await connectDB(uri);
    const result = await runBatch({ startIndex: Number(startIndex), limit: Number(limit), onlySheetType, onlyCompany, onlyKeywordRegex, allowAnyBlog: !!allowAnyBlog, maxContentChecks: Number(maxContentChecks), contentCheckDelay: Number(contentCheckDelay) });
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  } finally {
    await disconnectDB();
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`UI server listening on http://localhost:${PORT}`);
});
