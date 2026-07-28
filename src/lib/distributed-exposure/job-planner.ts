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
import { buildPageKeywordShards, type PageShardKeyword } from './page-shards';
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

export const PAGE_REMOTE_WORKER_COUNT = 7;
export const PAGE_JOB_MAX_SHARD_SIZE = 50;

export const buildPageTargetJobs = (
  target: Extract<PageCheckSheetType, 'pet' | 'suripet'>,
  keywords: readonly PageShardKeyword[]
): DistributedJobInput[] => {
  const shardSize = Math.min(
    PAGE_JOB_MAX_SHARD_SIZE,
    Math.max(1, Math.ceil(keywords.length / PAGE_REMOTE_WORKER_COUNT))
  );
  const shards = buildPageKeywordShards(keywords, shardSize);
  return shards.map((keywordIds, shardIndex) => ({
    target,
    shardIndex,
    shardCount: shards.length,
    keywordIds,
  }));
};

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
      logger.info(
        `[다중워커] root ${keywords.length}개 → 전용 서버 1개 작업`
      );
      jobs.push(
        toSingleSheetJob(
          target,
          keywords.map(({ _id }) => String(_id))
        )
      );
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
