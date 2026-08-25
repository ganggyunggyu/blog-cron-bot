import mongoose, { Document, Schema } from 'mongoose';
import type { RootCafeUrlRow, RootCafeUrlStatus } from './index';

/**
 * 샤드가 낸 결과를 모으는 곳.
 *
 * 워커는 대시보드와 다른 Railway 서비스라 output 디렉터리가 서로 다르다. 샤드가
 * 파일로만 쓰면 결과를 합칠 방법이 없어서, 공유하는 유일한 통로인 Mongo에 넣는다.
 * 한 번 보고 끝나는 임시 결과라 TTL로 알아서 지운다.
 */
const RESULT_TTL_SECONDS = 3 * 24 * 60 * 60;

export interface IRootCafeUrlResult extends Document {
  runId: string;
  shardIndex: number;
  cafeId: string;
  articleId: string;
  keyword: string;
  status: RootCafeUrlStatus;
  rank: string;
  link: string;
  error: string;
  createdAt: Date;
}

/*
 * 빈 문자열이 들어갈 수 있는 칸에는 required를 걸지 않는다.
 * mongoose는 String의 ''를 "값 없음"으로 보기 때문에 required와 같이 쓰면
 * rank: '' 한 칸 때문에 문서 전체가 검증에서 떨어진다.
 */
const resultSchema = new Schema<IRootCafeUrlResult>({
  runId: { type: String, required: true, index: true },
  shardIndex: { type: Number, required: true, default: 0 },
  cafeId: { type: String, required: true },
  articleId: { type: String, default: '' },
  keyword: { type: String, required: true },
  status: { type: String, required: true },
  rank: { type: String, default: '' },
  link: { type: String, default: '' },
  error: { type: String, default: '' },
  createdAt: {
    type: Date,
    required: true,
    default: () => new Date(),
    expires: RESULT_TTL_SECONDS,
  },
});

// 같은 조각이 재시도되면 지웠다 다시 넣으므로 (runId, keyword)가 겹치면 안 된다.
resultSchema.index({ runId: 1, keyword: 1 }, { unique: true });

export const RootCafeUrlResult =
  (mongoose.models.RootCafeUrlResult as mongoose.Model<IRootCafeUrlResult>) ??
  mongoose.model<IRootCafeUrlResult>('RootCafeUrlResult', resultSchema);

export const saveRootCafeUrlResults = async (input: {
  runId: string;
  shardIndex: number;
  cafeId: string;
  articleId: string;
  rows: readonly RootCafeUrlRow[];
}): Promise<void> => {
  if (input.rows.length === 0) return;
  // 재시도된 조각은 앞선 시도의 행을 남겨두면 안 된다. 지우고 다시 넣는다.
  await RootCafeUrlResult.deleteMany({
    runId: input.runId,
    keyword: { $in: input.rows.map(({ keyword }) => keyword) },
  });
  await RootCafeUrlResult.insertMany(
    input.rows.map((row) => ({
      runId: input.runId,
      shardIndex: input.shardIndex,
      cafeId: input.cafeId,
      articleId: input.articleId,
      keyword: row.keyword,
      status: row.status,
      rank: row.rank,
      link: row.link,
      error: row.error,
      createdAt: new Date(),
    })),
    // throwOnValidationError를 켜지 않으면 검증에 떨어진 문서를 조용히 버린다.
    // 조각은 "저장 완료"를 찍고 끝나는데 컬렉션은 비어 있는 상태가 그래서 나왔다.
    { ordered: false, throwOnValidationError: true }
  );
};

export const getRootCafeUrlResults = async (
  runId: string
): Promise<RootCafeUrlRow[]> => {
  const docs = await RootCafeUrlResult.find({ runId }).lean();
  return docs.map((doc) => ({
    keyword: doc.keyword,
    status: doc.status,
    rank: doc.rank,
    link: doc.link,
    error: doc.error,
  }));
};

export const clearRootCafeUrlResults = async (runId: string): Promise<void> => {
  await RootCafeUrlResult.deleteMany({ runId });
};
