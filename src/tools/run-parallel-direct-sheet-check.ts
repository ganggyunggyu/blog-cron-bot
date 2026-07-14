import * as dotenv from 'dotenv';
import os from 'os';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { createDetailedLogBuilder, saveDetailedLogs } from '../logs';
import { DetailedLogBuilder } from '../logs/detailed-log';
import { processKeywords } from '../lib/keyword-processor';
import { checkNaverLogin } from '../lib/check-naver-login';
import { logger } from '../lib/logger';
import { closeBrowser } from '../lib/playwright-crawler';
import { sendDoorayExposureResult } from '../lib/dooray';
import { getKSTTimestamp } from '../utils';
import { saveToCSV, saveToSheetCSV } from '../csv-writer';
import { EXPOSURE_SHEET_LOCATIONS } from '../constants';
import { DOGMARU_PAGE_CHECK_BLOG_IDS } from '../constants/blog-ids';
import { ExposureResult } from '../matcher';
import { autoLogin } from './auto-login';
import {
  connectDB,
  disconnectDB,
  saveExposureHistorySnapshots,
} from '../database';
import {
  createDirectUpdateCollector,
  DirectSheetUpdate,
  DirectSheetKeywordDoc,
  getGoogleSheetAuth,
  getWorksheetByTitle,
  loadKeywordsFromWorksheet,
  openSpreadsheet,
  writeResultsToWorksheet,
} from '../lib/google-sheets/direct-exposure-sheet';

dotenv.config();

type TargetType = 'package' | 'dogmaru-exclude' | 'dogmaru' | 'root';

interface TargetConfig {
  target: TargetType;
  label: string;
  sheetId: string;
  tabName: string;
  sheetType: string;
  csvPrefix: string;
  blogIds?: string[];
  allowAnyBlog?: boolean;
}

interface CliOptions {
  targets: TargetType[];
  dryRun: boolean;
  printOnly: boolean;
  limit: number;
  concurrency: number;
}

interface RunContext {
  runId: string;
  checkedAt: Date;
}

interface TargetRunResult {
  target: TargetType;
  label: string;
  keywords: number;
  exposureCount: number;
  popularCount: number;
  sblCount: number;
  elapsedTime: string;
  didWrite: boolean;
  missingKeywords: string[];
}

const ALL_TARGETS: TargetType[] = [
  'package',
  'dogmaru-exclude',
  'dogmaru',
  'root',
];

const DEFAULT_TARGET_CONCURRENCY = 2;

const TARGET_DEDUP_PRIORITY: Record<TargetType, number> = {
  'dogmaru-exclude': 1,
  package: 2,
  dogmaru: 3,
  root: 4,
};

const TARGET_CONFIGS: Record<TargetType, TargetConfig> = {
  package: {
    target: 'package',
    label: '패키지',
    sheetId: EXPOSURE_SHEET_LOCATIONS.패키지.sheetId,
    tabName: EXPOSURE_SHEET_LOCATIONS.패키지.tabTitle,
    sheetType: 'package',
    csvPrefix: 'direct-package',
  },
  'dogmaru-exclude': {
    target: 'dogmaru-exclude',
    label: '일반건',
    sheetId: EXPOSURE_SHEET_LOCATIONS.일반건.sheetId,
    tabName: EXPOSURE_SHEET_LOCATIONS.일반건.tabTitle,
    sheetType: 'dogmaru-exclude',
    csvPrefix: 'direct-dogmaru-exclude',
  },
  dogmaru: {
    target: 'dogmaru',
    label: '도그마루',
    sheetId: EXPOSURE_SHEET_LOCATIONS.도그마루.sheetId,
    tabName: EXPOSURE_SHEET_LOCATIONS.도그마루.tabTitle,
    sheetType: 'dogmaru',
    csvPrefix: 'direct-dogmaru',
    blogIds: DOGMARU_PAGE_CHECK_BLOG_IDS,
  },
  root: {
    target: 'root',
    label: '루트',
    sheetId: EXPOSURE_SHEET_LOCATIONS.루트.sheetId,
    tabName: EXPOSURE_SHEET_LOCATIONS.루트.tabTitle,
    sheetType: 'root',
    csvPrefix: 'direct-root',
    allowAnyBlog: false,
  },
};

const normalizeTarget = (value: string): TargetType | null => {
  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'package') return 'package';
  if (normalized === 'dogmaru-exclude' || normalized === 'general')
    return 'dogmaru-exclude';
  if (normalized === 'dogmaru') return 'dogmaru';
  if (normalized === 'root') return 'root';

  return null;
};

const parseTargets = (raw: string): TargetType[] => {
  const values = raw
    .split(',')
    .map((value) => normalizeTarget(value))
    .filter((value): value is TargetType => value !== null);

  if (values.length === 0) {
    throw new Error(`유효한 target이 없음: ${raw}`);
  }

  return Array.from(new Set(values));
};

const parsePositiveNumber = (value: string): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`양수만 허용됨: ${value}`);
  }

  return Math.floor(parsed);
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);

  let targets = [...ALL_TARGETS];
  let dryRun = false;
  let printOnly = false;
  let limit = 0;
  let concurrency = DEFAULT_TARGET_CONCURRENCY;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextArg = args[index + 1];

    if (arg === '--targets' && nextArg) {
      targets = parseTargets(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--limit' && nextArg) {
      limit = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--concurrency' && nextArg) {
      concurrency = parsePositiveNumber(nextArg);
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--print-only') {
      printOnly = true;
      continue;
    }

    throw new Error(`알 수 없는 인자: ${arg}`);
  }

  return {
    targets,
    dryRun,
    printOnly,
    limit,
    concurrency,
  };
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`;
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds % 60}초`;
  }

  return `${seconds}초`;
};

const ensureLoggedIn = async (): Promise<boolean> => {
  let loginStatus = await checkNaverLogin();

  logger.divider('로그인 상태');

  if (!loginStatus.isLoggedIn) {
    logger.warn('🔑 로그인 필요, 자동 로그인 시도...');

    const loginSuccess = await autoLogin();

    if (!loginSuccess) {
      throw new Error('자동 로그인 실패');
    }

    loginStatus = await checkNaverLogin();
  }

  if (!loginStatus.isLoggedIn) {
    throw new Error('로그인 확인 실패');
  }

  logger.success(
    `🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`
  );
  logger.blank();

  return true;
};

const limitKeywords = (
  keywords: DirectSheetKeywordDoc[],
  limit: number
): DirectSheetKeywordDoc[] => {
  if (limit < 1) {
    return keywords;
  }

  return keywords.slice(0, limit).map((keyword, index) => ({
    ...keyword,
    orderIndex: index,
  }));
};

const getTargetSummary = (
  label: string,
  keywords: DirectSheetKeywordDoc[]
): void => {
  const previewKeywords = keywords
    .slice(0, 10)
    .map(({ keyword }) => keyword)
    .join(', ');

  logger.info(`[${label}] ${keywords.length}개 키워드 로드`);

  if (previewKeywords) {
    logger.info(`[${label}] 시작 순서: ${previewKeywords}`);
  }
};

const buildHistorySnapshots = (
  sheetId: string,
  target: TargetConfig,
  context: RunContext,
  keywords: DirectSheetKeywordDoc[],
  updates: Map<string, DirectSheetUpdate>
) =>
  keywords.map((keyword) => {
    const update = updates.get(keyword._id);

    return {
      runId: context.runId,
      source: 'direct-sheet',
      sheetId,
      tabName: target.tabName,
      targetType: target.target,
      sheetType: target.sheetType,
      sheetRowNumber: keyword.sheetRowNumber,
      orderIndex: keyword.orderIndex,
      company: keyword.company,
      keyword: keyword.keyword,
      visibility: update?.visibility ?? false,
      popularTopic: update?.popularTopic ?? '',
      url: update?.url ?? '',
      postPublishedAt: update?.postPublishedAt ?? '',
      keywordType: update?.keywordType ?? 'basic',
      restaurantName: update?.restaurantName,
      matchedTitle: update?.matchedTitle,
      postVendorName: update?.postVendorName,
      rank: update?.rank ?? 0,
      rankWithCafe: update?.rankWithCafe ?? 0,
      isUpdateRequired: update?.isUpdateRequired ?? keyword.isUpdateRequired,
      isNewLogic: update?.isNewLogic ?? false,
      foundPage: update?.foundPage ?? 0,
    };
  });

interface TargetCrawlOutcome {
  config: TargetConfig;
  startedAt: number;
  keywords: DirectSheetKeywordDoc[];
  sheet: GoogleSpreadsheetWorksheet;
  results: ExposureResult[];
  updates: Map<string, DirectSheetUpdate>;
  keywordLogicMap: Map<string, boolean>;
  logBuilder: DetailedLogBuilder;
}

const normalizeDedupKeyword = (value: string): string =>
  String(value ?? '').trim().toLowerCase();

const normalizeDedupUrl = (value: string): string =>
  String(value ?? '').trim();

const buildDedupKey = (keyword: string, url: string): string =>
  `${normalizeDedupKeyword(keyword)}::${normalizeDedupUrl(url)}`;

const clearedDuplicateUpdate = (
  update: DirectSheetUpdate
): DirectSheetUpdate => ({
  ...update,
  visibility: false,
  popularTopic: '',
  url: '',
  postPublishedAt: '',
  matchedTitle: '',
  rank: 0,
  rankWithCafe: 0,
  postVendorName: '',
  restaurantName: '',
  foundPage: 0,
});

const applyCrossTargetDedup = (
  outcomes: TargetCrawlOutcome[]
): Map<TargetType, number> => {
  const removedByTarget = new Map<TargetType, number>(
    outcomes.map(({ config }) => [config.target, 0])
  );

  if (outcomes.length <= 1) {
    return removedByTarget;
  }

  const winners = new Map<string, TargetType>();
  const sortedOutcomes = [...outcomes].sort(
    (left, right) =>
      TARGET_DEDUP_PRIORITY[left.config.target] -
      TARGET_DEDUP_PRIORITY[right.config.target]
  );

  sortedOutcomes.forEach((outcome) => {
    outcome.keywords.forEach((keywordDoc) => {
      const update = outcome.updates.get(keywordDoc._id);

      if (!update?.visibility || !update.url) {
        return;
      }

      const dedupKey = buildDedupKey(keywordDoc.keyword, update.url);

      if (!winners.has(dedupKey)) {
        winners.set(dedupKey, outcome.config.target);
      }
    });
  });

  outcomes.forEach((outcome) => {
    let removed = 0;

    outcome.keywords.forEach((keywordDoc) => {
      const update = outcome.updates.get(keywordDoc._id);

      if (!update?.visibility || !update.url) {
        return;
      }

      const dedupKey = buildDedupKey(keywordDoc.keyword, update.url);
      const owner = winners.get(dedupKey);

      if (owner && owner !== outcome.config.target) {
        outcome.updates.set(keywordDoc._id, clearedDuplicateUpdate(update));
        removed += 1;
      }
    });

    if (removed > 0) {
      outcome.results = outcome.results.filter((result) => {
        const dedupKey = buildDedupKey(result.query, result.postLink || '');
        const owner = winners.get(dedupKey);
        return !owner || owner === outcome.config.target;
      });

      logger.info(
        `[${outcome.config.label}] 중복 노출 ${removed}건 제거 (다른 탭이 우선)`
      );
    }

    removedByTarget.set(outcome.config.target, removed);
  });

  return removedByTarget;
};

const runTargetCrawl = async (
  options: CliOptions,
  target: TargetConfig,
  isLoggedIn: boolean
): Promise<TargetCrawlOutcome> => {
  const startedAt = Date.now();
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(target.sheetId, auth);
  const sheet = getWorksheetByTitle(doc, target.tabName);
  const loadedKeywords = await loadKeywordsFromWorksheet(sheet, target.sheetType);
  const keywords = limitKeywords(loadedKeywords, options.limit);

  logger.divider(`${target.label} 직접 노출체크`);
  getTargetSummary(target.label, keywords);
  logger.info(`[${target.label}] 탭 내부 동시 처리: ${options.concurrency}개`);

  const logBuilder = createDetailedLogBuilder();
  const keywordLogicMap = new Map<string, boolean>();

  if (options.printOnly) {
    return {
      config: target,
      startedAt,
      keywords,
      sheet,
      results: [],
      updates: new Map<string, DirectSheetUpdate>(),
      keywordLogicMap,
      logBuilder,
    };
  }

  const { updates, updateFunction } = createDirectUpdateCollector();

  const results = await processKeywords(keywords, logBuilder, {
    updateFunction,
    isLoggedIn,
    concurrency: options.concurrency,
    blogIds: target.blogIds,
    allowAnyBlog: target.allowAnyBlog,
    keywordLogicMap,
  });

  return {
    config: target,
    startedAt,
    keywords,
    sheet,
    results,
    updates,
    keywordLogicMap,
    logBuilder,
  };
};

const finalizeTarget = async (
  options: CliOptions,
  context: RunContext,
  outcome: TargetCrawlOutcome,
  removedCount: number
): Promise<TargetRunResult> => {
  const {
    config: target,
    startedAt,
    keywords,
    sheet,
    results,
    updates,
    keywordLogicMap,
    logBuilder,
  } = outcome;

  if (options.printOnly) {
    return {
      target: target.target,
      label: target.label,
      keywords: keywords.length,
      exposureCount: 0,
      popularCount: 0,
      sblCount: 0,
      elapsedTime: '0초',
      didWrite: false,
      missingKeywords: [],
    };
  }

  const historySnapshots = buildHistorySnapshots(
    target.sheetId,
    target,
    context,
    keywords,
    updates
  );
  const historySaveResult = await saveExposureHistorySnapshots(
    context.checkedAt,
    historySnapshots
  );

  logger.info(
    `[${target.label}] DB 스냅샷 저장 완료: ${historySaveResult.inserted}개 (${historySaveResult.collectionName})`
  );

  const timestamp = getKSTTimestamp();

  saveToCSV(results, `${target.csvPrefix}_${timestamp}.csv`);
  saveToSheetCSV(
    keywords.map(({ keyword, company }) => ({
      keyword,
      company,
    })),
    results,
    `${target.csvPrefix}_sheet_${timestamp}.csv`,
    keywordLogicMap
  );

  if (!options.dryRun) {
    await writeResultsToWorksheet(sheet, keywords, updates);
  }

  const elapsedTime = formatDuration(Date.now() - startedAt);
  const popularCount = results.filter(
    ({ exposureType }) => exposureType === '인기글'
  ).length;
  const sblCount = results.filter(({ exposureType }) => exposureType === '스블').length;
  const missingKeywords = keywords
    .filter(({ _id, isUpdateRequired }) => {
      const update = updates.get(_id);
      return !(update?.visibility ?? false) && !isUpdateRequired;
    })
    .map(({ keyword }) => keyword);

  saveDetailedLogs(logBuilder.getLogs(), `${target.csvPrefix}_${timestamp}`, elapsedTime);

  const summaryItems = [
    { label: '총 검색어', value: `${keywords.length}개` },
    { label: '총 노출 발견', value: `${results.length}개` },
    { label: '인기글', value: `${popularCount}개` },
    { label: '스블', value: `${sblCount}개` },
    { label: '처리 시간', value: elapsedTime },
    { label: '시트 반영', value: options.dryRun ? '건너뜀' : '완료' },
  ];

  if (removedCount > 0) {
    summaryItems.splice(2, 0, {
      label: '탭 중복 제거',
      value: `${removedCount}개`,
    });
  }

  logger.summary.complete(`${target.label} 직접 노출체크 완료`, summaryItems);

  if (!options.dryRun) {
    await sendDoorayExposureResult({
      cronType: `${target.label} (직접병렬)`,
      totalKeywords: keywords.length,
      exposureCount: results.length,
      popularCount,
      sblCount,
      elapsedTime,
      missingKeywords,
    });
  }

  return {
    target: target.target,
    label: target.label,
    keywords: keywords.length,
    exposureCount: results.length,
    popularCount,
    sblCount,
    elapsedTime,
    didWrite: !options.dryRun,
    missingKeywords,
  };
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const startTime = Date.now();
  const context: RunContext = {
    runId: getKSTTimestamp(),
    checkedAt: new Date(),
  };
  let didConnectDb = false;

  const targetSheetSummary = options.targets
    .map((target) => `${TARGET_CONFIGS[target].label}=${TARGET_CONFIGS[target].sheetId}`)
    .join(', ');

  logger.summary.start('DIRECT PARALLEL SHEET CHECK', [
    { label: '시작', value: context.checkedAt.toLocaleString('ko-KR') },
    { label: 'OS', value: `${os.platform()} (${os.arch()})` },
    { label: '시트', value: targetSheetSummary },
    { label: '타겟', value: options.targets.join(', ') },
    { label: '탭 내부 동시성', value: `${options.concurrency}` },
    { label: '모드', value: options.printOnly ? 'print-only' : options.dryRun ? 'dry-run' : 'write' },
  ]);

  try {
    if (!options.printOnly) {
      const mongoUri = String(process.env.MONGODB_URI ?? '').trim();

      if (!mongoUri) {
        throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
      }

      await connectDB(mongoUri);
      didConnectDb = true;
    }

    const isLoggedIn = await ensureLoggedIn();
    const targetConfigs = options.targets.map((target) => TARGET_CONFIGS[target]);
    const settledCrawls = await Promise.allSettled(
      targetConfigs.map((target) => runTargetCrawl(options, target, isLoggedIn))
    );

    const crawlOutcomes = settledCrawls.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    );
    const crawlFailures = settledCrawls.flatMap((result, index) =>
      result.status === 'rejected'
        ? [
            {
              label: targetConfigs[index].label,
              reason:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            },
          ]
        : []
    );

    const removedByTarget = applyCrossTargetDedup(crawlOutcomes);
    const totalRemoved = Array.from(removedByTarget.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    if (totalRemoved > 0) {
      logger.info(`📎 탭 간 중복 노출 총 ${totalRemoved}건 정리`);
    }

    const settledFinalizes = await Promise.allSettled(
      crawlOutcomes.map((outcome) =>
        finalizeTarget(
          options,
          context,
          outcome,
          removedByTarget.get(outcome.config.target) ?? 0
        )
      )
    );

    const succeeded = settledFinalizes.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    );
    const finalizeFailures = settledFinalizes.flatMap((result, index) =>
      result.status === 'rejected'
        ? [
            {
              label: crawlOutcomes[index].config.label,
              reason:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            },
          ]
        : []
    );

    const failed = [...crawlFailures, ...finalizeFailures];

    logger.divider('병렬 실행 결과');

    succeeded.forEach((result) => {
      logger.success(
        `${result.label}: ${result.keywords}개 중 ${result.exposureCount}개 노출 (${result.elapsedTime})`
      );
    });

    failed.forEach(({ label, reason }) => {
      logger.error(`${label}: 실패 - ${reason}`);
    });

    logger.summary.complete('DIRECT PARALLEL SHEET CHECK COMPLETE', [
      { label: '성공', value: `${succeeded.length}개` },
      { label: '실패', value: `${failed.length}개` },
      { label: '총 소요', value: formatDuration(Date.now() - startTime) },
    ]);

    if (failed.length > 0) {
      throw new Error(
        failed.map(({ label, reason }) => `${label}: ${reason}`).join(' | ')
      );
    }
  } finally {
    await closeBrowser();

    if (didConnectDb) {
      await disconnectDB();
    }
  }
};

main().catch((error) => {
  logger.error(`직접 병렬 시트 체크 오류: ${(error as Error).message}`);
  process.exit(1);
});
