import { crawlWithRetryWithoutCookie } from '../../crawler';
import { matchBlogs } from '../../matcher';
import { extractPopularItems } from '../../parser';
import { progressLogger } from '../../logs/progress-logger';
import { GuestRetryComparison } from '../../types';
import { logger } from '../logger';
import { findMatchingPost } from '../post-filter';
import { getAllowAnyBlog } from './allow-any-blog';
import { GuestRetryParams, GuestRetryResult } from './types';

export const runGuestRetry = async (
  params: GuestRetryParams
): Promise<GuestRetryResult> => {
  const {
    searchQuery,
    query,
    keywordDoc,
    topicNamesArray,
    matchQueue,
    vendorTarget,
    restaurantName,
    caches,
    baseMatchesCount,
    existingLinks,
    logNewMatches,
  } = params;

  try {
    progressLogger.retry('비로그인 재시도');

    const guestHtml = await crawlWithRetryWithoutCookie(searchQuery, 2);
    const guestItems = extractPopularItems(guestHtml);

    const loginTopics = new Set(topicNamesArray);
    const guestTopics = new Set(guestItems.map((item: any) => item.group));
    const guestTopicsArray = Array.from(guestTopics);

    const onlyInLogin = topicNamesArray.filter((topic) => !guestTopics.has(topic));
    const onlyInGuest = guestTopicsArray.filter((topic) => !loginTopics.has(topic));
    const commonTopics = topicNamesArray.filter((topic) => guestTopics.has(topic));

    const allowAnyBlog = getAllowAnyBlog(keywordDoc.sheetType);
    const guestMatches = matchBlogs(query, guestItems, { allowAnyBlog });

    const guestAddedLinks =
      caches.guestAddedLinksCache.get(searchQuery) || new Set<string>();
    const usedLinks = caches.usedLinksCache.get(searchQuery) || new Set<string>();

    const newMatches = guestMatches.filter(
      (match) =>
        !existingLinks.has(match.postLink) &&
        !guestAddedLinks.has(match.postLink) &&
        !usedLinks.has(match.postLink)
    );

    progressLogger.topicComparison({
      loginTopics: topicNamesArray,
      guestTopics: guestTopicsArray,
      commonTopics,
      onlyInLogin,
      onlyInGuest,
      loginMatches: baseMatchesCount,
      guestMatches: guestMatches.length,
      newMatches: newMatches.length,
    });

    const guestRetryComparison: GuestRetryComparison = {
      attempted: true,
      recovered: false,
      loginTopics: topicNamesArray,
      guestTopics: guestTopicsArray,
      onlyInLogin,
      onlyInGuest,
      commonTopics,
      loginMatchCount: baseMatchesCount,
      guestMatchCount: guestMatches.length,
      newMatchCount: newMatches.length,
      newPosts: newMatches.map((match) => ({
        blogName: match.blogName,
        postTitle: match.postTitle,
        topicName: match.topicName,
      })),
    };

    if (newMatches.length > 0) {
      if (logNewMatches) {
        logger.debug(`[비로그인 전용 포스트]`);
        newMatches.forEach((match, idx) => {
          logger.debug(
            `${idx + 1}. ${match.blogName} - "${match.postTitle.slice(0, 30)}..." (${match.topicName})`
          );
        });
      }

      if (!caches.guestAddedLinksCache.has(searchQuery)) {
        caches.guestAddedLinksCache.set(searchQuery, new Set());
      }
      newMatches.forEach((match) =>
        caches.guestAddedLinksCache.get(searchQuery)!.add(match.postLink)
      );

      const queueBeforeAdd = matchQueue.length;
      matchQueue.push(...newMatches);
      progressLogger.queueChange(queueBeforeAdd, matchQueue.length, 'add');

      const retryResult = await findMatchingPost(
        matchQueue,
        vendorTarget,
        restaurantName
      );

      if (retryResult.passed && retryResult.match) {
        if (retryResult.matchedIndex >= 0) {
          matchQueue.splice(retryResult.matchedIndex, 1);
        }

        progressLogger.guestRetryResult(true, retryResult.match.blogName);

        guestRetryComparison.recovered = true;

        return {
          attempted: true,
          recovered: true,
          guestMatchesCount: guestMatches.length,
          addedMatchesCount: newMatches.length,
          retryResult: {
            matchedIndex: retryResult.matchedIndex,
            match: retryResult.match,
            vendor: retryResult.vendor,
            vendorDetails: retryResult.vendorDetails,
            source: retryResult.source,
          },
          guestRetryComparison,
        };
      }
    } else {
      progressLogger.guestRetryResult(false);
    }

    return {
      attempted: true,
      recovered: false,
      guestMatchesCount: guestMatches.length,
      addedMatchesCount: newMatches.length,
      guestRetryComparison,
    };
  } catch (err) {
    progressLogger.retry(`재시도 실패: ${(err as Error).message.slice(0, 30)}`);
  }

  return {
    attempted: false,
    recovered: false,
    guestMatchesCount: 0,
    addedMatchesCount: 0,
  };
};
