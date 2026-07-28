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

/**
 * 애견/서리펫은 시트당 워커 1개가 키워드 수백 개를 전부 떠안아서, 여러 원격 워커가
 * 동시에 떠 있어도 실제로는 워커 1대만 일하는 구조였다. 같은 검색어는 한 조각에
 * 묶은 채 50개 단위로 잘라 job을 여러 개 만들면, 이미 떠 있는 여러 워커가 조각을
 * 하나씩 나눠 집어가서 진짜로 병렬 처리된다.
 */
export const PAGE_JOB_SHARD_SIZE = 50;

export const buildPageTargetJobs = (
  target: Extract<PageCheckSheetType, 'pet' | 'suripet'>,
  keywords: readonly PageShardKeyword[]
): DistributedJobInput[] => {
  const shards = buildPageKeywordShards(keywords, PAGE_JOB_SHARD_SIZE);
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
