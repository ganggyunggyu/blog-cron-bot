import {
  getAllRootKeywords,
  getPageCheckKeywords,
  type PageCheckSheetType,
} from '../../database';
import { importSheetAPI } from '../../cron-pages';
import { syncRootKeywordsFromSheet } from '../../cron-root';
import type { ExposureTargetId } from '../exposure-suite/options';
import { logger } from '../logger';
import { buildPageKeywordShards } from './page-shards';
import type { DistributedJobInput } from './queue';

const PAGE_SHARD_SIZE = 50;

export const isDistributedPageTarget = (
  target: ExposureTargetId
): target is Extract<PageCheckSheetType, 'pet' | 'suripet'> =>
  target === 'pet' || target === 'suripet';

const appendShards = (
  jobs: DistributedJobInput[],
  target: ExposureTargetId,
  keywordIdsByShard: string[][]
): void => {
  keywordIdsByShard.forEach((keywordIds, shardIndex) => {
    jobs.push({
      target,
      shardIndex,
      shardCount: keywordIdsByShard.length,
      keywordIds,
    });
  });
};

export const prepareDistributedJobs = async (
  targets: ExposureTargetId[]
): Promise<DistributedJobInput[]> => {
  const jobs: DistributedJobInput[] = [];

  for (const target of targets) {
    if (target === 'root') {
      await syncRootKeywordsFromSheet();
      const keywords = await getAllRootKeywords();
      const shards = buildPageKeywordShards(keywords, PAGE_SHARD_SIZE);
      if (shards.length === 0) throw new Error('root 처리 키워드가 없음');
      logger.info(
        `[다중워커] root ${keywords.length}개 → 50개 기준 ${shards.length}개 작업`
      );
      appendShards(jobs, target, shards);
      continue;
    }

    if (!isDistributedPageTarget(target)) {
      jobs.push({ target });
      continue;
    }

    await importSheetAPI(target);
    const keywords = await getPageCheckKeywords(target);
    const shards = buildPageKeywordShards(keywords, PAGE_SHARD_SIZE);
    if (shards.length === 0) throw new Error(`${target} 처리 키워드가 없음`);
    logger.info(
      `[다중워커] ${target} ${keywords.length}개 → 50개 기준 ${shards.length}개 작업`
    );
    appendShards(jobs, target, shards);
  }

  return jobs;
};
