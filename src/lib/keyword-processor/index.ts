import { ExposureResult, matchBlogs } from '../../matcher';
import { updateKeywordResult } from '../../database';
import { getSearchQuery } from '../../utils';
import { DetailedLogBuilder } from '../../logs/detailed-log';
import { findMatchingPost } from '../post-filter';
import { crawlWithRetryWithoutCookie } from '../../crawler';
import { extractPopularItems } from '../../parser';
import { getSheetOptions } from '../../sheet-config';
import { logger } from '../logger';
import { progressLogger } from '../../logs/progress-logger';
import { GuestRetryComparison } from '../../types';
import {
  KeywordContext,
  ProcessingContext,
  HtmlStructure,
  CrawlCaches,
  ProcessKeywordsOptions,
  UpdateFunction,
} from './types';
import {
  handleExcluded,
  handleQueueEmpty,
  handleSuccess,
  handleFilterFailure,
} from './handlers';
import {
  extractRestaurantName,
  shouldExclude,
  getKeywordType,
  getVendorTarget,
  getIsNewLogic,
} from './keyword-classifier';
import { getCrawlResult } from './crawl-manager';

/**
 * 모든 키워드를 순차적으로 처리 (크롤링, 필터링, 결과 저장)
 */
export const processKeywords = async (
  keywords: any[],
  logBuilder: DetailedLogBuilder,
  options?: ProcessKeywordsOptions
): Promise<ExposureResult[]> => {
  const updateFunction: UpdateFunction =
    options?.updateFunction ?? updateKeywordResult;
  const isLoggedIn = options?.isLoggedIn ?? false;
  const maxPages = options?.maxPages ?? 1;
  const allResults: ExposureResult[] = [];

  // 1️⃣ 크롤링 캐시 및 매칭 큐 (searchQuery별)
  const caches: CrawlCaches = {
    crawlCache: new Map<string, string>(),
    matchQueueMap: new Map<string, ExposureResult[]>(),
    itemsCache: new Map<string, any[]>(),
    htmlStructureCache: new Map<
      string,
      { isPopular: boolean; uniqueGroups: number; topicNames: string[] }
    >(),
    guestAddedLinksCache: new Map<string, Set<string>>(),
    usedLinksCache: new Map<string, Set<string>>(),
  };

  logger.info(`🔍 총 ${keywords.length}개 키워드 처리`);
  logger.blank();

  // 2️⃣ 키워드를 원래 순서대로 하나씩 처리
  let globalIndex = 0;

  for (const keywordDoc of keywords) {
    const query = keywordDoc.keyword;
    const searchQuery = getSearchQuery(query || '');
    globalIndex++;
    const keywordStartTime = Date.now();

    // 하단 진행 상태 업데이트
    logger.statusLine.update(globalIndex, keywords.length, query);

    const restaurantName = extractRestaurantName(keywordDoc, query);
    const company = String((keywordDoc as any).company || '').trim();
    const keywordType = getKeywordType(keywordDoc, restaurantName);

    // 3️⃣ 크롤링 먼저 실행 (isNewLogic 판단을 위해)
    const crawlResult = await getCrawlResult(
      searchQuery,
      keywordDoc,
      query,
      globalIndex,
      keywords.length,
      keywordStartTime,
      keywordType,
      caches,
      logBuilder,
      updateFunction,
      maxPages
    );

    if (!crawlResult) continue;

    const { items, isPopular, uniqueGroupsSize, topicNamesArray } = crawlResult;
    const isNewLogic = getIsNewLogic(topicNamesArray);

    // ⚠️ 프로그램 제외 대상 체크 (크롤링 후 판단)
    if (shouldExclude(company, query)) {
      await handleExcluded({
        keyword: {
          keywordDoc,
          query,
          searchQuery,
          restaurantName,
          vendorTarget: '',
          keywordType,
        },
        company,
        processing: {
          globalIndex,
          totalKeywords: keywords.length,
          keywordStartTime,
          logBuilder,
        },
        updateFunction,
        isNewLogic,
      });
      continue;
    }

    // 4️⃣ 큐 가져오기
    const matchQueue = caches.matchQueueMap.get(searchQuery)!;
    const allMatchesCount = matchQueue.length;

    // vendorTarget 계산
    const vendorTarget = getVendorTarget(keywordDoc, restaurantName);

    // 5️⃣ 큐가 비었으면 비로그인 재시도 후 실패 처리
    if (matchQueue.length === 0) {
      // 비로그인 재시도 (이미 비로그인 모드면 스킵)
      let queueEmptyRetrySuccess = false;
      if (isLoggedIn) {
      try {
        progressLogger.retry(`비로그인 재시도`);

        const guestHtml = await crawlWithRetryWithoutCookie(searchQuery, 2);
        const guestItems = extractPopularItems(guestHtml);

        // 🔍 로그인/비로그인 인기주제 비교
        const loginTopics = new Set(topicNamesArray);
        const guestTopics = new Set(guestItems.map((item: any) => item.group));
        const guestTopicsArray = Array.from(guestTopics);

        const onlyInLogin = topicNamesArray.filter((t) => !guestTopics.has(t));
        const onlyInGuest = guestTopicsArray.filter((t) => !loginTopics.has(t));
        const commonTopics = topicNamesArray.filter((t) => guestTopics.has(t));

        const sheetOpts = getSheetOptions((keywordDoc as any).sheetType);
        const allowAnyEnv = String(process.env.ALLOW_ANY_BLOG || '').toLowerCase();
        const allowAnyBlog =
          allowAnyEnv === 'true' || allowAnyEnv === '1'
            ? true
            : allowAnyEnv === 'false' || allowAnyEnv === '0'
            ? false
            : !!sheetOpts.allowAnyBlog;

        const guestMatches = matchBlogs(query, guestItems, { allowAnyBlog });

        // 기존 아이템 + 이미 추가된 비로그인 포스트 + 이미 사용된 포스트 기준 중복 제거
        const originalItems = caches.itemsCache.get(searchQuery) || [];
        const existingLinks = new Set(originalItems.map((item: any) => item.link));
        const guestAddedLinks = caches.guestAddedLinksCache.get(searchQuery) || new Set();
        const usedLinks = caches.usedLinksCache.get(searchQuery) || new Set();
        const newMatches = guestMatches.filter(
          (m) => !existingLinks.has(m.postLink) && !guestAddedLinks.has(m.postLink) && !usedLinks.has(m.postLink)
        );

        // 비교 결과 시각화
        progressLogger.topicComparison({
          loginTopics: topicNamesArray,
          guestTopics: guestTopicsArray,
          commonTopics,
          onlyInLogin,
          onlyInGuest,
          loginMatches: 0,
          guestMatches: guestMatches.length,
          newMatches: newMatches.length,
        });

        if (newMatches.length > 0) {

          // 캐시에 추가된 링크 기록
          if (!caches.guestAddedLinksCache.has(searchQuery)) {
            caches.guestAddedLinksCache.set(searchQuery, new Set());
          }
          newMatches.forEach((m) => caches.guestAddedLinksCache.get(searchQuery)!.add(m.postLink));

          const queueBefore = matchQueue.length;
          matchQueue.push(...newMatches);
          progressLogger.queueChange(queueBefore, matchQueue.length, 'add');

          const retryResult = await findMatchingPost(matchQueue, vendorTarget, restaurantName);

          if (retryResult.passed && retryResult.match) {
            if (retryResult.matchedIndex >= 0) {
              matchQueue.splice(retryResult.matchedIndex, 1);
            }

            progressLogger.guestRetryResult(true, retryResult.match.blogName);

            const keywordCtx: KeywordContext = {
              keywordDoc, query, searchQuery, restaurantName, vendorTarget, keywordType,
            };
            const htmlCtx: HtmlStructure = {
              items, isPopular, uniqueGroupsSize, topicNamesArray,
            };
            const processingCtx: ProcessingContext = {
              globalIndex, totalKeywords: keywords.length, keywordStartTime, logBuilder,
            };

            const guestRetryInfo: GuestRetryComparison = {
              attempted: true,
              recovered: true,
              loginTopics: topicNamesArray,
              guestTopics: guestTopicsArray,
              onlyInLogin,
              onlyInGuest,
              commonTopics,
              loginMatchCount: 0,
              guestMatchCount: guestMatches.length,
              newMatchCount: newMatches.length,
              newPosts: newMatches.map((m) => ({
                blogName: m.blogName,
                postTitle: m.postTitle,
                topicName: m.topicName,
              })),
            };

            // 사용된 포스트 링크 기록 (같은 키워드 중복 방지)
            if (!caches.usedLinksCache.has(searchQuery)) {
              caches.usedLinksCache.set(searchQuery, new Set());
            }
            caches.usedLinksCache.get(searchQuery)!.add(retryResult.match.postLink);

            await handleSuccess({
              keyword: keywordCtx,
              html: htmlCtx,
              match: {
                nextMatch: retryResult.match,
                extractedVendor: retryResult.vendor,
                matchSource: retryResult.source,
                vendorMatchDetails: retryResult.vendorDetails,
                allMatchesCount: guestMatches.length,
                remainingQueueCount: matchQueue.length,
              },
              processing: processingCtx,
              allResults,
              updateFunction,
              guestRetryComparison: guestRetryInfo,
            });
            queueEmptyRetrySuccess = true;
          }
        } else {
          progressLogger.guestRetryResult(false);
        }
      } catch (err) {
        progressLogger.retry(`재시도 실패: ${(err as Error).message.slice(0, 30)}`);
      }
      } // isLoggedIn

      if (!queueEmptyRetrySuccess) {
        await handleQueueEmpty({
          keyword: {
            keywordDoc,
            query,
            searchQuery,
            restaurantName,
            vendorTarget,
            keywordType,
          },
          html: { items, isPopular, uniqueGroupsSize, topicNamesArray },
          processing: {
            globalIndex,
            totalKeywords: keywords.length,
            keywordStartTime,
            logBuilder,
          },
          updateFunction,
        });
      }
      continue;
    }

    // 6️⃣, 7️⃣ 필터링
    const filterResult = await findMatchingPost(
      matchQueue,
      vendorTarget,
      restaurantName
    );

    let {
      matchedIndex,
      match: nextMatch,
      passed,
      source: matchSource,
      vendor: extractedVendor,
      vendorDetails: vendorMatchDetails,
    } = filterResult;

    // 큐에서 제거
    if (matchedIndex >= 0) {
      matchQueue.splice(matchedIndex, 1);
    }

    // 8️⃣ 결과 처리
    const keywordCtx: KeywordContext = {
      keywordDoc,
      query,
      searchQuery,
      restaurantName,
      vendorTarget,
      keywordType,
    };
    const htmlCtx: HtmlStructure = {
      items,
      isPopular,
      uniqueGroupsSize,
      topicNamesArray,
    };
    const processingCtx: ProcessingContext = {
      globalIndex,
      totalKeywords: keywords.length,
      keywordStartTime,
      logBuilder,
    };

    if (passed && nextMatch) {
      // 사용된 포스트 링크 기록 (같은 키워드 중복 방지)
      if (!caches.usedLinksCache.has(searchQuery)) {
        caches.usedLinksCache.set(searchQuery, new Set());
      }
      caches.usedLinksCache.get(searchQuery)!.add(nextMatch.postLink);

      await handleSuccess({
        keyword: keywordCtx,
        html: htmlCtx,
        match: {
          nextMatch,
          extractedVendor,
          matchSource,
          vendorMatchDetails,
          allMatchesCount,
          remainingQueueCount: matchQueue.length,
        },
        processing: processingCtx,
        allResults,
        updateFunction,
      });
    } else {
      // 🔄 미노출 시 비로그인으로 재시도 (이미 비로그인 모드면 스킵)
      let retrySuccess = false;
      let guestRetryInfo: GuestRetryComparison | undefined;
      if (isLoggedIn) {
      try {
        progressLogger.retry(`비로그인 재시도`);

        const guestHtml = await crawlWithRetryWithoutCookie(searchQuery, 2);
        const guestItems = extractPopularItems(guestHtml);

        // 🔍 로그인/비로그인 인기주제 비교
        const loginTopics = new Set(topicNamesArray);
        const guestTopics = new Set(guestItems.map((item: any) => item.group));
        const guestTopicsArray = Array.from(guestTopics);

        const onlyInLogin = topicNamesArray.filter((t) => !guestTopics.has(t));
        const onlyInGuest = guestTopicsArray.filter((t) => !loginTopics.has(t));
        const commonTopics = topicNamesArray.filter((t) => guestTopics.has(t));

        const sheetOpts = getSheetOptions((keywordDoc as any).sheetType);
        const allowAnyEnv = String(process.env.ALLOW_ANY_BLOG || '').toLowerCase();
        const allowAnyBlog =
          allowAnyEnv === 'true' || allowAnyEnv === '1'
            ? true
            : allowAnyEnv === 'false' || allowAnyEnv === '0'
            ? false
            : !!sheetOpts.allowAnyBlog;

        const guestMatches = matchBlogs(query, guestItems, { allowAnyBlog });

        // 기존 큐 + 이미 추가된 비로그인 포스트 + 이미 사용된 포스트 기준 중복 제거
        const existingLinks = new Set(matchQueue.map((m) => m.postLink));
        const guestAddedLinks = caches.guestAddedLinksCache.get(searchQuery) || new Set();
        const usedLinks = caches.usedLinksCache.get(searchQuery) || new Set();

        // 새로운 매칭만 필터링해서 큐에 추가
        const newMatches = guestMatches.filter(
          (m) => !existingLinks.has(m.postLink) && !guestAddedLinks.has(m.postLink) && !usedLinks.has(m.postLink)
        );

        // 비교 결과 시각화
        progressLogger.topicComparison({
          loginTopics: topicNamesArray,
          guestTopics: guestTopicsArray,
          commonTopics,
          onlyInLogin,
          onlyInGuest,
          loginMatches: allMatchesCount,
          guestMatches: guestMatches.length,
          newMatches: newMatches.length,
        });

        // 비로그인 비교 정보 저장
        guestRetryInfo = {
          attempted: true,
          recovered: false,
          loginTopics: topicNamesArray,
          guestTopics: guestTopicsArray,
          onlyInLogin,
          onlyInGuest,
          commonTopics,
          loginMatchCount: allMatchesCount,
          guestMatchCount: guestMatches.length,
          newMatchCount: newMatches.length,
          newPosts: newMatches.map((m) => ({
            blogName: m.blogName,
            postTitle: m.postTitle,
            topicName: m.topicName,
          })),
        };

        if (newMatches.length > 0) {
          logger.debug(`[비로그인 전용 포스트]`);
          newMatches.forEach((m, idx) => {
            logger.debug(`${idx + 1}. ${m.blogName} - "${m.postTitle.slice(0, 30)}..." (${m.topicName})`);
          });

          // 캐시에 추가된 링크 기록
          if (!caches.guestAddedLinksCache.has(searchQuery)) {
            caches.guestAddedLinksCache.set(searchQuery, new Set());
          }
          newMatches.forEach((m) => caches.guestAddedLinksCache.get(searchQuery)!.add(m.postLink));

          const queueBeforeAdd = matchQueue.length;
          matchQueue.push(...newMatches);
          progressLogger.queueChange(queueBeforeAdd, matchQueue.length, 'add');

          // 다시 필터링 시도
          const retryResult = await findMatchingPost(
            matchQueue,
            vendorTarget,
            restaurantName
          );

          if (retryResult.passed && retryResult.match) {
            // 큐에서 제거
            if (retryResult.matchedIndex >= 0) {
              matchQueue.splice(retryResult.matchedIndex, 1);
            }

            progressLogger.guestRetryResult(true, retryResult.match.blogName);

            guestRetryInfo.recovered = true;

            // 사용된 포스트 링크 기록 (같은 키워드 중복 방지)
            if (!caches.usedLinksCache.has(searchQuery)) {
              caches.usedLinksCache.set(searchQuery, new Set());
            }
            caches.usedLinksCache.get(searchQuery)!.add(retryResult.match.postLink);

            await handleSuccess({
              keyword: keywordCtx,
              html: htmlCtx,
              match: {
                nextMatch: retryResult.match,
                extractedVendor: retryResult.vendor,
                matchSource: retryResult.source,
                vendorMatchDetails: retryResult.vendorDetails,
                allMatchesCount: allMatchesCount + newMatches.length,
                remainingQueueCount: matchQueue.length,
              },
              processing: processingCtx,
              allResults,
              updateFunction,
              guestRetryComparison: guestRetryInfo,
            });
            retrySuccess = true;
          }
        } else {
          progressLogger.guestRetryResult(false);
        }
      } catch (err) {
        progressLogger.retry(`재시도 실패: ${(err as Error).message.slice(0, 30)}`);
      }
      } // isLoggedIn

      // 재시도에서도 실패한 경우
      if (!retrySuccess) {
        await handleFilterFailure({
          keyword: keywordCtx,
          html: htmlCtx,
          allMatchesCount,
          remainingQueueCount: matchQueue.length,
          processing: processingCtx,
          updateFunction,
          guestRetryComparison: guestRetryInfo,
        });
      }
    }
  }

  // 진행 상태 줄 정리
  logger.statusLine.done();

  return allResults;
};
