import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllKeywords,
  getPageCheckKeywords,
  type IKeyword,
  type IPageCheckKeyword,
} from '../database';
import { extractBlogId, type ExposureResult } from '../matcher';
import { rewriteOrderedResultSheet } from '../lib/google-sheets/ordered-result-sheet';
import { writePetResultsToSheet } from '../lib/google-sheets/pet-page-check';
import { writeSuripetResultsToSheet } from '../lib/google-sheets/suripet-page-check';
import { logger } from '../lib/logger';
import { reexportCurrentCafeResults } from '../lib/google-sheets/cafe-current-reexport';

dotenv.config();

const TARGETS = [
  'package',
  'general',
  'dogmaru',
  'pet',
  'suripet',
  'cafe',
] as const;
type ReexportTarget = (typeof TARGETS)[number];

const SHEET_TYPES: Record<Extract<ReexportTarget, 'package' | 'general' | 'dogmaru'>, string> = {
  package: 'package',
  general: 'dogmaru-exclude',
  dogmaru: 'dogmaru',
};

interface ResultKeyword {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  postPublishedAt?: string;
  matchedTitle?: string;
  rank?: number;
  rankWithCafe?: number;
  isNewLogic?: boolean;
  foundPage?: number;
}

const toExposureResult = (keyword: ResultKeyword): ExposureResult => ({
  query: keyword.keyword,
  company: keyword.company,
  blogId: extractBlogId(keyword.url),
  blogName: '',
  postTitle: keyword.matchedTitle ?? '',
  postLink: keyword.url,
  postPublishedAt: keyword.postPublishedAt,
  exposureType: keyword.popularTopic,
  topicName: keyword.popularTopic,
  position: keyword.rank ?? 0,
  positionWithCafe: keyword.rankWithCafe,
  isNewLogic: keyword.isNewLogic,
  page: keyword.foundPage,
});

const parseTargets = (): ReexportTarget[] => {
  const raw = process.argv
    .find((argument) => argument.startsWith('--targets='))
    ?.slice('--targets='.length);
  if (!raw) return [...TARGETS];

  const targets = raw.split(',').map((value) => value.trim());
  const invalid = targets.filter(
    (target) => !TARGETS.includes(target as ReexportTarget)
  );
  if (invalid.length > 0) {
    throw new Error(`지원하지 않는 재내보내기 대상: ${invalid.join(', ')}`);
  }
  return targets as ReexportTarget[];
};

const reexportStandardTarget = async (
  target: Extract<ReexportTarget, 'package' | 'general' | 'dogmaru'>,
  allKeywords: IKeyword[]
): Promise<number> => {
  const keywords = allKeywords.filter(
    ({ sheetType }) => sheetType === SHEET_TYPES[target]
  );
  const results = keywords
    .filter(({ visibility }) => visibility)
    .map(toExposureResult);
  const rewrite = await rewriteOrderedResultSheet(
    target,
    results,
    undefined,
    keywords.map(({ company, keyword }) => ({ company, keyword }))
  );
  return rewrite.rowCount;
};

const reexportPetTarget = async (
  target: Extract<ReexportTarget, 'pet' | 'suripet'>
): Promise<number> => {
  const keywords = await getPageCheckKeywords(target);
  const results = keywords.map((keyword: IPageCheckKeyword) => ({
    keyword: keyword.keyword,
    visibility: keyword.visibility,
    popularTopic: keyword.popularTopic,
    url: keyword.url,
    postPublishedAt: keyword.postPublishedAt,
    keywordType: keyword.keywordType,
    matchedTitle: keyword.matchedTitle,
    rank: keyword.rank,
    rankWithCafe: keyword.rankWithCafe,
    isUpdateRequired: keyword.isUpdateRequired,
    isNewLogic: keyword.isNewLogic,
    foundPage: keyword.foundPage,
  }));

  if (target === 'pet') await writePetResultsToSheet(results);
  else await writeSuripetResultsToSheet(results);
  return results.length;
};

const reexportTarget = async (
  target: ReexportTarget,
  allKeywords: IKeyword[]
): Promise<number> => {
  if (target === 'cafe') return reexportCurrentCafeResults();
  if (target === 'pet' || target === 'suripet') {
    return reexportPetTarget(target);
  }
  return reexportStandardTarget(target, allKeywords);
};

const main = async (): Promise<void> => {
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');

  const targets = parseTargets();
  await connectDB(mongoUri);
  try {
    const standardTargets = targets.filter(
      (target): target is Extract<ReexportTarget, 'package' | 'general' | 'dogmaru'> =>
        target !== 'pet' && target !== 'suripet' && target !== 'cafe'
    );
    const allKeywords = standardTargets.length > 0 ? await getAllKeywords() : [];

    for (const target of targets) {
      const rowCount = await reexportTarget(target, allKeywords);
      logger.success(`${target}: 원본 순서 ${rowCount}행 재내보내기 완료`);
    }
  } finally {
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`현재 결과 재내보내기 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
