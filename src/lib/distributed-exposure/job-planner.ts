import {
  getAllRootKeywords,
  getPageCheckKeywords,
  type PageCheckSheetType,
} from '../../database';
import { importSheetAPI } from '../../cron-pages';
import type { ExposureTargetId } from '../exposure-suite/options';
import { logger } from '../logger';
import {
  isRootSourceSchemaMismatch,
  syncRootKeywordsFromSheet,
} from '../root-keyword-sync';
import {
  buildBalancedPageKeywordShards,
  type PageShardKeyword,
} from './page-shards';
import type { DistributedJobInput } from './queue';

export const isDistributedPageTarget = (
  target: ExposureTargetId
): target is Extract<PageCheckSheetType, 'pet' | 'suripet'> =>
  target === 'pet' || target === 'suripet';

const toSingleSheetJob = (
  target: ExposureTargetId,
  keywordIds: string[] = []
): DistributedJobInput => ({
  target,
  shardIndex: 0,
  shardCount: 1,
  keywordIds,
});

// 페이지 노출체크는 30개 원격 워커에 균등 분배한다.
export const PAGE_REMOTE_WORKER_COUNT = 30;
export const PAGE_JOB_MAX_SHARD_SIZE = 50;

export const buildKeywordTargetJobs = (
  target: Extract<ExposureTargetId, 'root' | 'pet' | 'suripet'>,
  keywords: readonly PageShardKeyword[]
): DistributedJobInput[] => {
  const shards = buildBalancedPageKeywordShards(
    keywords,
    PAGE_REMOTE_WORKER_COUNT,
    PAGE_JOB_MAX_SHARD_SIZE
  );
  return shards.map((keywordIds, shardIndex) => ({
    target,
    shardIndex,
    shardCount: shards.length,
    keywordIds,
  }));
};

export const buildPageTargetJobs = (
  target: Extract<PageCheckSheetType, 'pet' | 'suripet'>,
  keywords: readonly PageShardKeyword[]
): DistributedJobInput[] => buildKeywordTargetJobs(target, keywords);

export const prepareDistributedJobs = async (
  targets: ExposureTargetId[]
): Promise<DistributedJobInput[]> => {
  const jobs: DistributedJobInput[] = [];

  for (const target of targets) {
    if (target === 'root') {
      try {
        await syncRootKeywordsFromSheet();
      } catch (error) {
        if (!isRootSourceSchemaMismatch(error)) throw error;
        logger.warn(
          `[다중워커] 신규 루트 문서에 키워드 표가 없어 기존 RootKeyword DB를 보존합니다: ` +
            `${(error as Error).message}`
        );
      }
      const keywords = await getAllRootKeywords();
      if (keywords.length === 0) throw new Error('root 처리 키워드가 없음');
      const targetJobs = buildKeywordTargetJobs(
        target,
        keywords.map(({ _id, keyword }) => ({ _id, keyword }))
      );
      logger.info(
        `[다중워커] root ${keywords.length}개 → ${targetJobs.length}개 조각으로 병렬 처리`
      );
      jobs.push(...targetJobs);
      continue;
    }

    if (!isDistributedPageTarget(target)) {
      jobs.push(toSingleSheetJob(target));
      continue;
    }

    await importSheetAPI(target);
    const keywords = await getPageCheckKeywords(target);
    if (keywords.length === 0) throw new Error(`${target} 처리 키워드가 없음`);
    const targetJobs = buildPageTargetJobs(
      target,
      keywords.map(({ _id, keyword }) => ({ _id, keyword }))
    );
    logger.info(
      `[다중워커] ${target} ${keywords.length}개 → ${targetJobs.length}개 조각으로 병렬 처리`
    );
    jobs.push(...targetJobs);
  }

  return jobs;
};
