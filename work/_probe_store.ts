import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/database';
import { DistributedExposureJob } from '../src/lib/distributed-exposure/models';
import { RootCafeUrlResult } from '../src/lib/root-cafe-url-check/store';

dotenv.config();
const main = async () => {
  await connectDB(String(process.env.MONGODB_URI));
  const total = await RootCafeUrlResult.countDocuments({});
  console.log('RootCafeUrlResult 전체 행:', total);
  const runs = await RootCafeUrlResult.distinct('runId');
  console.log('runId 목록:', runs);
  const jobs = await DistributedExposureJob.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('\n최근 잡 10개:');
  jobs.forEach((j: any) =>
    console.log(`  ${j.runId.slice(0,8)} shard${j.shardIndex} ${j.jobKind} ${j.status} attempts=${j.attempts}` +
      (j.error ? ` err=${String(j.error).slice(0,90)}` : ''))
  );
  await disconnectDB();
};
main().catch((e) => { console.error(e); process.exit(1); });
