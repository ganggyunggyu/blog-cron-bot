import {
  DetailedLog,
  MatchedPostInfo,
  VendorMatchDetails,
  TitleMatchDetails,
  GuestRetryComparison,
} from '../../types';

interface HtmlStructure {
  isPopular: boolean;
  uniqueGroups: number;
  topicNames: string[];
}

interface BaseLogParams {
  index: number;
  keyword: string;
  searchQuery: string;
  restaurantName: string;
  vendorTarget: string;
  startTime: number;
}

interface ParsedLogParams extends BaseLogParams {
  totalItemsParsed: number;
  htmlStructure: HtmlStructure;
  allMatchesCount: number;
  availableMatchesCount: number;
}

export class DetailedLogBuilder {
  private logs: DetailedLog[] = [];

  createFailure(params: BaseLogParams & { reason: string }): DetailedLog {
    const { index, keyword, searchQuery, restaurantName, vendorTarget, startTime, reason } = params;

    return {
      index,
      keyword,
      searchQuery,
      restaurantName,
      vendorTarget,
      success: false,
      totalItemsParsed: 0,
      htmlStructure: { isPopular: false, uniqueGroups: 0, topicNames: [] },
      allMatchesCount: 0,
      availableMatchesCount: 0,
      failureReason: reason,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    };
  }

  createCrawlError(params: BaseLogParams & { error: Error }): DetailedLog {
    return this.createFailure({
      ...params,
      reason: `크롤링 에러: ${params.error.message}`,
    });
  }

  createExcluded(params: BaseLogParams): DetailedLog {
    return this.createFailure({
      ...params,
      reason: '프로그램 제외 대상',
    });
  }

  createFilterFailure(params: ParsedLogParams & {
    hasVendorTarget: boolean;
    guestRetryComparison?: GuestRetryComparison;
  }): DetailedLog {
    const {
      index, keyword, searchQuery, restaurantName, vendorTarget,
      startTime, totalItemsParsed, htmlStructure,
      allMatchesCount, availableMatchesCount, hasVendorTarget,
      guestRetryComparison,
    } = params;

    return {
      index,
      keyword,
      searchQuery,
      restaurantName,
      vendorTarget,
      success: false,
      totalItemsParsed,
      htmlStructure,
      allMatchesCount,
      availableMatchesCount,
      guestRetryComparison,
      failureReason: hasVendorTarget
        ? 'VENDOR 및 TITLE 필터링 모두 실패'
        : 'TITLE 필터링 실패 (토큰 미포함)',
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    };
  }

  createSuccess(
    params: ParsedLogParams & {
      matchSource: 'VENDOR' | 'TITLE';
      matchedPost: MatchedPostInfo;
      vendorMatchDetails?: VendorMatchDetails;
      titleMatchDetails?: TitleMatchDetails;
      guestRetryComparison?: GuestRetryComparison;
    }
  ): DetailedLog {
    const {
      index, keyword, searchQuery, restaurantName, vendorTarget,
      startTime, totalItemsParsed, htmlStructure,
      allMatchesCount, availableMatchesCount,
      matchSource, matchedPost, vendorMatchDetails, titleMatchDetails,
      guestRetryComparison,
    } = params;

    return {
      index,
      keyword,
      searchQuery,
      restaurantName,
      vendorTarget,
      success: true,
      matchSource,
      totalItemsParsed,
      htmlStructure,
      allMatchesCount,
      availableMatchesCount,
      matchedPost,
      vendorMatchDetails,
      titleMatchDetails,
      guestRetryComparison,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    };
  }

  push(log: DetailedLog): void {
    this.logs.push(log);
  }

  getLogs(): DetailedLog[] {
    return this.logs;
  }

  getStats() {
    const total = this.logs.length;
    const success = this.logs.filter((l) => l.success).length;
    const failed = total - success;
    return { total, success, failed };
  }

  clear(): void {
    this.logs = [];
  }
}

export const createDetailedLogBuilder = () => new DetailedLogBuilder();
