import {
  getAllRootKeywords,
  getAllKeywords,
  getPageCheckKeywords,
  type PageCheckSheetType,
} from '../../database';
import { requests } from '../../constants';
import { importSheetAPI } from '../../cron-pages';
import type { ExposureTargetId } from '../exposure-suite/options';
import { logger } from '../logger';
import { syncKeywordsFromSourceSheet } from '../sheet-keyword-sync';
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

// 대상별 조각을 한 대상씩 밀어 넣으면 큐 선두 대상이 워커를 독점한다.
// 같은 실행에 여러 시트가 있으면 0번 조각끼리, 1번 조각끼리 교차해 배치한다.
export const interleaveTargetJobs = (
  jobs: readonly DistributedJobInput[]
): DistributedJobInput[] => {
  const byTarget = new Map<ExposureTargetId, DistributedJobInput[]>();
  jobs.forEach((job) => {
    const targetJobs = byTarget.get(job.target) ?? [];
    targetJobs.push(job);
    byTarget.set(job.target, targetJobs);
  });

  const interleaved: DistributedJobInput[] = [];
  const maxShardCount = Math.max(
    0,
    ...Array.from(byTarget.values(), (targetJobs) => targetJobs.length)
  );
  for (let shardIndex = 0; shardIndex < maxShardCount; shardIndex += 1) {
    byTarget.forEach((targetJobs) => {
      const job = targetJobs[shardIndex];
      if (job) interleaved.push(job);
    });
  }
  return interleaved;
};

/**
 * 조각 수는 Railway에 상시 떠 있는 워커 수와 같아야 한다.
 *
 * 조각이 워커보다 많으면 남는 조각이 다음 차례를 기다리느라 실행이 길어지고,
 * 적으면 워커가 놀면서 요금만 나간다. 워커 복제본 수를 바꿀 때 코드를 다시
 * 배포하지 않아도 되도록 환경변수로 맞춘다.
 */
export const DEFAULT_REMOTE_WORKER_COUNT = 10;
export const PAGE_JOB_MAX_SHARD_SIZE = 50;

export const resolveRemoteWorkerCount = (
  rawValue: string | undefined = process.env.EXPOSURE_REMOTE_WORKER_COUNT
): number => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_REMOTE_WORKER_COUNT;
  return parsed;
};

export const buildKeywordTargetJobs = (
  target: ExposureTargetId,
  keywords: readonly PageShardKeyword[]
): DistributedJobInput[] => {
  const shards = buildBalancedPageKeywordShards(
    keywords,
    resolveRemoteWorkerCount(),
    PAGE_JOB_MAX_SHARD_SIZE
  );
  return shards.map((keywordIds, shardIndex) => ({
    target,
    shardIndex,
    shardCount: shards.length,
    keywordIds,
  }));
};

export const OLD_LOGIC_MORE_OUTPUT_TITLES = {
  package: '패키지_더보기',
  general: '일반건_더보기',
  dogmaru: '도그마루_더보기',
} as const;

export const OLD_LOGIC_MORE_SOURCE_NAMES = {
  package: '패키지',
  general: '일반건',
  dogmaru: '도그마루',
} as const;

const DIRECT_DATABASE_TARGETS = {
  package: { sheetType: 'package', requestIndex: 0 },
  general: { sheetType: 'dogmaru-exclude', requestIndex: 1 },
  dogmaru: { sheetType: 'dogmaru', requestIndex: 2 },
} as const;

const isDirectDatabaseTarget = (
  target: ExposureTargetId
): target is keyof typeof DIRECT_DATABASE_TARGETS =>
  target in DIRECT_DATABASE_TARGETS;

export const isOldLogicMoreTarget = (
  target: ExposureTargetId
): target is keyof typeof OLD_LOGIC_MORE_OUTPUT_TITLES =>
  target in OLD_LOGIC_MORE_OUTPUT_TITLES;

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

    if (isDirectDatabaseTarget(target)) {
      const definition = DIRECT_DATABASE_TARGETS[target];
      await syncKeywordsFromSourceSheet(requests[definition.requestIndex]);
      const keywords = (await getAllKeywords()).filter(
        ({ sheetType }) => sheetType === definition.sheetType
      );
      if (keywords.length === 0) throw new Error(`${target} 처리 키워드가 없음`);
      const targetJobs = buildKeywordTargetJobs(
        target,
        keywords.map(({ _id, keyword }) => ({ _id, keyword }))
      );
      logger.info(
        `[다중워커] ${target} ${keywords.length}개 → ${targetJobs.length}개 조각으로 병렬 처리`
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

  return interleaveTargetJobs(jobs);
};

export const prepareDistributedOldLogicMoreJobs = async (
  targets: Array<keyof typeof OLD_LOGIC_MORE_OUTPUT_TITLES>
): Promise<DistributedJobInput[]> => {
  const jobs: DistributedJobInput[] = [];

  for (const target of targets) {
    const definition = DIRECT_DATABASE_TARGETS[target];
    await syncKeywordsFromSourceSheet(requests[definition.requestIndex]);
    const keywords = (await getAllKeywords()).filter(
      ({ sheetType, isNewLogic }) =>
        sheetType === definition.sheetType && isNewLogic !== true
    );
    if (keywords.length === 0) throw new Error(`${target} 처리 키워드가 없음`);
    const keywordById = new Map(
      keywords.map(({ _id, keyword }) => [String(_id), keyword])
    );
    const targetJobs = buildKeywordTargetJobs(
      target,
      keywords.map(({ _id, keyword }) => ({ _id, keyword }))
    ).map((job) => ({
      ...job,
      jobKind: 'old-logic-more' as const,
      keywordIds: job.keywordIds?.map((keywordId) => {
        const keyword = keywordById.get(keywordId);
        if (!keyword) throw new Error(`${target} 키워드 해석 실패: ${keywordId}`);
        return keyword;
      }),
    }));
    logger.info(
      `[더보기 다중워커] ${target} ${keywords.length}개 → ${targetJobs.length}개 조각으로 병렬 처리`
    );
    jobs.push(...targetJobs);
  }

  return interleaveTargetJobs(jobs);
};
