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
import { syncRootKeywordsFromSheet } from '../lib/root-keyword-sync';
import { getKSTTimestamp, getSearchQuery } from '../utils';

/**
 * 실패가 이만큼 넘으면 결과를 못 믿는다.
 *
 * 403이 몰리면 확인 못 한 키워드가 전부 미노출처럼 보이는데, 그대로 exit 0으로
 * 끝나면 대시보드에 초록불이 뜬다. "안 걸렸다"와 "못 봤다"는 다른 답이다.
 */
const MAX_FAILURE_RATIO = 0.2;

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
    // 시트를 먼저 맞춘다. 이걸 빼면 DB가 비어 있어도 "키워드 0개, 노출 0개"로
    // 정상 종료해서 진짜 0건과 구분이 안 된다. cron-root도 같은 순서로 돈다.
    const syncResult = await syncRootKeywordsFromSheet();
    logger.success(
      `루트 시트 동기화 완료 (삭제 ${syncResult.deleted}, 삽입 ${syncResult.inserted})`
    );

    const rootKeywords = await getAllRootKeywords();
    // 루트 키워드는 "청주맛집(아키아키)"처럼 업체명이 붙어 오는데, 크롤러가 괄호를
    // 떼고 검색하므로 업체만 다른 행은 같은 검색이다. 원문으로 중복을 지우면 같은
    // 검색을 두 번 때린다.
    const keywords = Array.from(
      new Map(
        rootKeywords
          .map(({ keyword }) => String(keyword ?? '').trim())
          .filter(Boolean)
          .map((keyword) => [getSearchQuery(keyword), keyword])
      ).values()
    );
    if (keywords.length === 0) throw new Error('루트 키워드가 하나도 없음');
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

    if (failed.length > keywords.length * MAX_FAILURE_RATIO) {
      throw new Error(
        `${keywords.length}개 중 ${failed.length}개를 확인하지 못해 결과를 믿을 수 없음. ` +
          `잠시 뒤 다시 실행해야 함 (결과 파일: ${outputPath})`
      );
    }

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
