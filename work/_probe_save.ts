import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/database';
import {
  RootCafeUrlResult,
  saveRootCafeUrlResults,
  getRootCafeUrlResults,
} from '../src/lib/root-cafe-url-check/store';

dotenv.config();
const main = async () => {
  await connectDB(String(process.env.MONGODB_URI));
  const runId = 'probe-run-1';
  await saveRootCafeUrlResults({
    runId,
    shardIndex: 0,
    cafeId: 'localtable702',
    articleId: '',
    rows: [
      { keyword: 'k1', status: '미노출', rank: '', link: '', error: '' },
      { keyword: 'k2', status: '노출', rank: '3', link: 'https://x', error: '' },
    ],
  });
  console.log('저장 직후 count:', await RootCafeUrlResult.countDocuments({ runId }));
  console.log('읽기:', JSON.stringify(await getRootCafeUrlResults(runId)));
  console.log('컬렉션 이름:', RootCafeUrlResult.collection.name);
  console.log('db 이름:', RootCafeUrlResult.db.name);
  await RootCafeUrlResult.deleteMany({ runId });
  await disconnectDB();
};
main().catch((e) => { console.error('ERR', e); process.exit(1); });
