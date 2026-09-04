import {
  getPageCheckKeywords,
  replacePageCheckKeywords,
} from '../../database';
import {
  loadPetKeywordsFromSheet,
  writePetResultsToSheet,
} from '../google-sheets/pet-page-check';
import {
  loadSuripetKeywordsFromSheet,
  writeSuripetResultsToSheet,
} from '../google-sheets/suripet-page-check';
import { logger } from '../logger';
import { PAGE_CHECK_SHEET_TYPE_NAMES } from './config';

export const exportSuripetSheetDirect = async (): Promise<void> => {
  const keywords = await getPageCheckKeywords('suripet');
  await writeSuripetResultsToSheet(
    keywords.map((keyword) => ({
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
    }))
  );
};

export const exportPetSheetDirect = async (): Promise<void> => {
  const keywords = await getPageCheckKeywords('pet');
  await writePetResultsToSheet(
    keywords.map((keyword) => ({
      keyword: keyword.keyword,
      visibility: keyword.visibility,
      popularTopic: keyword.popularTopic,
      url: keyword.url,
      rank: keyword.rank,
      rankWithCafe: keyword.rankWithCafe,
      isNewLogic: keyword.isNewLogic,
    }))
  );
};

export const syncSuripetKeywordsFromSheetToDB = async (): Promise<number> => {
  const keywords = await loadSuripetKeywordsFromSheet();
  const synced = await replacePageCheckKeywords('suripet', keywords);

  logger.success(
    `  ${PAGE_CHECK_SHEET_TYPE_NAMES.suripet}: ${synced}개 직접 동기화`
  );

  return synced;
};

export const syncPetKeywordsFromSheetToDB = async (): Promise<number> => {
  const keywords = await loadPetKeywordsFromSheet();
  const synced = await replacePageCheckKeywords('pet', keywords);

  logger.success(
    `  ${PAGE_CHECK_SHEET_TYPE_NAMES.pet}: ${synced}개 직접 동기화`
  );

  return synced;
};
