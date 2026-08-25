import * as dotenv from 'dotenv';
import * as fs from 'fs';
import {
  connectDB,
  disconnectDB,
  getAllRootKeywords,
  type IRootKeyword,
} from '../database';
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
import { saveRootCafeUrlResults } from '../lib/root-cafe-url-check/store';
import { syncRootKeywordsFromSheet } from '../lib/root-keyword-sync';
import { getKSTTimestamp, getSearchQuery } from '../utils';

dotenv.config();

/**
 * 실패가 이만큼 넘으면 결과를 못 믿는다.
 *
 * 403이 몰리면 확인 못 한 키워드가 전부 미노출처럼 보이는데, 그대로 exit 0으로
 * 끝나면 대시보드에 초록불이 뜬다. "안 걸렸다"와 "못 봤다"는 다른 답이다.
 */
const MAX_FAILURE_RATIO = 0.2;

const rawUrl =
  process.argv.find((value) => value.startsWith('--url='))?.slice(6) ?? '';

/**
 * 분산 실행에서 이 프로세스가 맡은 몫.
 *
 * 조각으로 돌 때는 자기 키워드만 보고 결과를 Mongo에 넣는다. 요약 상자와 결과
 * 파일은 조각마다 찍히면 열 개가 겹치므로 혼자 돌 때만 낸다. 환경변수 이름은
 * cron-root가 쓰는 것과 맞췄다.
 */
const isShard = process.env.DISTRIBUTED_EXPOSURE_SHARD === 'true';
const shardRunId = String(process.env.DISTRIBUTED_EXPOSURE_RUN_ID ?? '').trim();
const shardIndex =
  Number(process.env.DISTRIBUTED_EXPOSURE_SHARD_INDEX ?? 0) || 0;
const shardKeywordIds = new Set(
  String(process.env.DISTRIBUTED_EXPOSURE_KEYWORD_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const countBy = (
  rows: readonly RootCafeUrlRow[],
  status: RootCafeUrlRow['status']
): RootCafeUrlRow[] => rows.filter((row) => row.status === status);

/**
 * 검색 기준으로 중복을 지운다.
 *
 * 루트 키워드는 "청주맛집(아키아키)"처럼 업체명이 붙어 오는데 크롤러가 괄호를 떼고
 * 검색하므로, 업체만 다른 행은 같은 검색이다. 원문으로 지우면 같은 검색을 두 번 한다.
 */
const toUniqueKeywords = (rows: readonly IRootKeyword[]): string[] =>
  Array.from(
    new Map(
      rows
        .map(({ keyword }) => String(keyword ?? '').trim())
        .filter(Boolean)
        .map((keyword) => [getSearchQuery(keyword), keyword])
    ).values()
  );

const loadKeywords = async (): Promise<string[]> => {
  if (isShard) {
    // 조각은 시트를 다시 맞추지 않는다. 열 조각이 동시에 같은 컬렉션을 지웠다 넣으면
    // 서로의 키워드를 날린다. 동기화는 오케스트레이터가 한 번만 한다.
    const all = await getAllRootKeywords();
    const mine = all.filter((keyword) =>
      shardKeywordIds.has(String(keyword._id))
    );
    if (mine.length !== shardKeywordIds.size) {
      throw new Error(
        `분산 카페 URL 키워드 스냅샷 불일치: ${mine.length}/${shardKeywordIds.size}`
      );
    }
    return toUniqueKeywords(mine);
  }

  const syncResult = await syncRootKeywordsFromSheet();
  logger.success(
    `루트 시트 동기화 완료 (삭제 ${syncResult.deleted}, 삽입 ${syncResult.inserted})`
  );
  return toUniqueKeywords(await getAllRootKeywords());
};

const main = async (): Promise<void> => {
  const parsed = parseNaverCafeUrl(rawUrl);
  if (!parsed.ok) throw new Error(CAFE_URL_FAILURE_MESSAGES[parsed.reason]);
  const target = { cafeId: parsed.cafeId, articleId: parsed.articleId };

  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  await connectDB(mongoUri);

  try {
    const keywords = await loadKeywords();
    if (keywords.length === 0) throw new Error('루트 키워드가 하나도 없음');
    logger.info(
      target.articleId
        ? `루트 키워드 ${keywords.length}개에서 ${target.cafeId} ${target.articleId}번 글을 찾음`
        : `루트 키워드 ${keywords.length}개에서 ${target.cafeId} 카페 글을 찾음`
    );

    const results = await checkRootCafeUrlExposure(keywords, target);
    const rows = Array.from(results.values());

    if (isShard) {
      await saveRootCafeUrlResults({
        runId: shardRunId,
        shardIndex,
        cafeId: target.cafeId,
        articleId: target.articleId,
        rows,
      });
      // 조각도 실패가 많으면 성공으로 끝내지 않는다. 그래야 이 조각만 다시 돈다.
      const failedCount = countBy(rows, '확인실패').length;
      if (failedCount > rows.length * MAX_FAILURE_RATIO) {
        throw new Error(
          `조각 ${shardIndex}: ${rows.length}개 중 ${failedCount}개 확인 실패`
        );
      }
      logger.success(
        `[분산 카페URL] 조각 ${shardIndex} ${rows.length}개 처리 완료`
      );
      return;
    }

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
