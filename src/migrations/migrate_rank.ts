import * as dotenv from 'dotenv';
import { connectDB, disconnectDB, Keyword } from '../database';

dotenv.config();

const log = (...args: unknown[]) => console.log('[migrate:rank]', ...args);

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  try {
    const filter = {
      matchedPosition: { $exists: true },
    } as Record<string, unknown>;

    const toCopyFilter = {
      matchedPosition: { $exists: true },
      $or: [{ rank: { $exists: false } }, { rank: 0 }],
    } as Record<string, unknown>;

    const totalWithOld = await Keyword.countDocuments(filter);
    const needsCopy = await Keyword.countDocuments(toCopyFilter);

    log(`총 matchedPosition 보유 문서: ${totalWithOld}`);
    log(`rank 채움 필요 문서: ${needsCopy}`);

    if (needsCopy > 0) {
      // Fetch and bulk write to ensure compatibility across Mongo/Mongoose versions
      const docs = await Keyword.find(toCopyFilter)
        .select({ _id: 1, matchedPosition: 1 })
        .lean();

      const ops = docs
        .filter((d: any) => typeof d.matchedPosition !== 'undefined')
        .map((d: any) => ({
          updateOne: {
            filter: { _id: d._id },
            update: { $set: { rank: Number(d.matchedPosition) || 0 } },
          },
        }));

      if (ops.length > 0) {
        const res = await Keyword.bulkWrite(ops, { ordered: false });
        log(`rank 복사 완료: matchedPosition → rank (modified: ${res.modifiedCount})`);
      }
    } else {
      log('복사할 문서가 없습니다.');
    }

    if (totalWithOld > 0) {
      const unsetRes = await Keyword.updateMany(filter, { $unset: { matchedPosition: '' } });
      log(`matchedPosition 필드 제거 완료: ${unsetRes.modifiedCount}`);
    }

    log('마이그레이션 완료');
  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main().catch((e) => {
  console.error('❌ 실행 오류:', e);
  process.exit(1);
});

