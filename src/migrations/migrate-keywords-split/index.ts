import * as dotenv from 'dotenv';
import { connectDB, disconnectDB, Keyword } from '../../database';

dotenv.config();

const log = (...args: unknown[]) => console.log('[migrate:keywords_split]', ...args);

const extractRestaurant = (keyword: string): { base: string; restaurant: string } => {
  const kw = String(keyword || '');
  const m = kw.match(/\(([^)]+)\)/);
  const restaurant = m ? m[1].trim() : '';
  const base = kw.replace(/\([^)]*\)/g, '').trim();
  return { base, restaurant };
};

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  try {
    const docs = await Keyword.find({}).select({ _id: 1, keyword: 1, restaurantName: 1 }).lean();
    log(`총 문서: ${docs.length}`);

    const ops: any[] = [];
    for (const d of docs) {
      const { base, restaurant } = extractRestaurant(d.keyword as string);
      const nextRestaurant = (d as any).restaurantName || restaurant;

      const needsKeyword = base.length > 0 && base !== d.keyword;
      const needsRestaurant =
        typeof (d as any).restaurantName === 'undefined'
          ? nextRestaurant.length > 0
          : (d as any).restaurantName !== nextRestaurant;

      if (needsKeyword || needsRestaurant) {
        const $set: Record<string, unknown> = {};
        if (needsKeyword) $set.keyword = base;
        if (needsRestaurant) $set.restaurantName = nextRestaurant;
        ops.push({ updateOne: { filter: { _id: d._id }, update: { $set } } });
      }
    }

    if (ops.length > 0) {
      const res = await (Keyword as any).bulkWrite(ops, { ordered: false });
      log(`업데이트 완료: modified=${res.modifiedCount}`);
    } else {
      log('변경할 문서가 없습니다.');
    }

    log('키워드/식당명 분리 마이그레이션 완료');
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

export { main as migrateKeywordsSplit, extractRestaurant };
