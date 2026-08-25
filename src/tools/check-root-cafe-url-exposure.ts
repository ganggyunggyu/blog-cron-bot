import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { connectDB, disconnectDB, getAllRootKeywords } from '../database';
import { resolveOutputFilePath } from '../lib/csv-output/output-path';
import { logger } from '../lib/logger';
import {
  CAFE_URL_FAILURE_MESSAGES,
  parseNaverCafeUrl,
} from '../lib/naver-cafe-url';
import {
  checkRootCafeUrlExposure,
  type RootCafeUrlRow,
} from '../lib/root-cafe-url-check';
import { getKSTTimestamp } from '../utils';

dotenv.config();

const rawUrl =
  process.argv.find((value) => value.startsWith('--url='))?.slice(6) ?? '';

const countBy = (
  rows: readonly RootCafeUrlRow[],
  status: RootCafeUrlRow['status']
): RootCafeUrlRow[] => rows.filter((row) => row.status === status);

const main = async (): Promise<void> => {
  const parsed = parseNaverCafeUrl(rawUrl);
  if (!parsed.ok) throw new Error(CAFE_URL_FAILURE_MESSAGES[parsed.reason]);
  const target = { cafeId: parsed.cafeId, articleId: parsed.articleId };

  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  await connectDB(mongoUri);

  try {
    const rootKeywords = await getAllRootKeywords();
    const keywords = Array.from(
      new Set(rootKeywords.map((keyword) => keyword.keyword).filter(Boolean))
    );
    logger.info(
      target.articleId
        ? `루트 키워드 ${keywords.length}개에서 ${target.cafeId} ${target.articleId}번 글을 찾음`
        : `루트 키워드 ${keywords.length}개에서 ${target.cafeId} 카페 글을 찾음`
    );

    const results = await checkRootCafeUrlExposure(keywords, target);
    const rows = Array.from(results.values());
    const exposed = countBy(rows, '노출');
    const otherArticle = countBy(rows, '같은 카페 다른 글');
    const failed = countBy(rows, '확인실패');

    const outputPath = resolveOutputFilePath(
      `root_cafe_url_${getKSTTimestamp()}.json`
    );
    fs.writeFileSync(
      outputPath,
      `${JSON.stringify(
        {
          summary: {
            url: rawUrl,
            cafeId: target.cafeId,
            articleId: target.articleId,
            totalKeywords: keywords.length,
            exposedCount: exposed.length,
            otherArticleCount: otherArticle.length,
            failedCount: failed.length,
          },
          rows,
        },
        null,
        2
      )}\n`
    );

    logger.summary.complete('루트 · 카페 URL 노출체크 완료', [
      { label: '카페', value: target.cafeId },
      { label: '글 번호', value: target.articleId || '(카페 전체)' },
      { label: '전체 키워드', value: `${keywords.length}개` },
      { label: '노출', value: `${exposed.length}개` },
      { label: '같은 카페 다른 글', value: `${otherArticle.length}개` },
      { label: '확인실패', value: `${failed.length}개` },
    ]);
    if (exposed.length > 0) {
      logger.info(
        `노출 키워드: ${exposed
          .map(({ keyword, rank }) => `${keyword}(${rank}위)`)
          .join(', ')}`
      );
    }
    if (otherArticle.length > 0) {
      logger.info(
        `같은 카페 다른 글이 걸린 키워드: ${otherArticle
          .map(({ keyword }) => keyword)
          .join(', ')}`
      );
    }
    logger.success(`결과 저장: ${outputPath}`);
  } finally {
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`루트 카페 URL 노출체크 실패: ${(error as Error).message}`);
  process.exit(1);
});
