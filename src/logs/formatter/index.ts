import { DetailedLog } from '../../types';

const BOX_WIDTH = 70;
const LINE = '─'.repeat(BOX_WIDTH);
const DOUBLE_LINE = '═'.repeat(BOX_WIDTH);

// 한글 등 넓은 문자 너비 계산
const getDisplayWidth = (str: string): number => {
  let width = 0;
  for (const char of str) {
    // 한글, 한자, 일본어 등은 2칸
    if (/[\u1100-\u11FF\u3000-\u303F\u3130-\u318F\uAC00-\uD7AF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
};

// 표시 너비 기준 패딩
const padEndDisplay = (str: string, targetWidth: number): string => {
  const currentWidth = getDisplayWidth(str);
  const padding = Math.max(0, targetWidth - currentWidth);
  return str + ' '.repeat(padding);
};

// 문자열 자르기 (표시 너비 기준)
const sliceDisplay = (str: string, maxWidth: number): string => {
  let width = 0;
  let result = '';
  for (const char of str) {
    const charWidth = /[\u1100-\u11FF\u3000-\u303F\u3130-\u318F\uAC00-\uD7AF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(char) ? 2 : 1;
    if (width + charWidth > maxWidth) break;
    result += char;
    width += charWidth;
  }
  return result;
};

// 박스 라인 생성 헬퍼
const boxLine = (content: string, width: number = BOX_WIDTH): string => {
  const contentWidth = getDisplayWidth(content);
  const padding = Math.max(0, width - contentWidth - 2);
  return `│ ${content}${' '.repeat(padding)}│`;
};

export function formatLogHeader(
  logs: DetailedLog[],
  elapsedTimeStr: string
): string[] {
  const successCount = logs.filter((l) => l.success).length;
  const failCount = logs.length - successCount;
  const successRate = logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0;

  return [
    '',
    `╔${DOUBLE_LINE}╗`,
    boxLine(`📊 노출 검출 리포트`),
    `╠${DOUBLE_LINE}╣`,
    boxLine(`생성: ${new Date().toLocaleString('ko-KR')}`),
    boxLine(`처리 시간: ${elapsedTimeStr}`),
    `╠${DOUBLE_LINE}╣`,
    boxLine(`총 처리: ${logs.length}  성공: ${successCount}  실패: ${failCount}  성공률: ${successRate}%`),
    `╚${DOUBLE_LINE}╝`,
    '',
  ];
}

export function formatLogSeparator(): string {
  return `┌${LINE}┐`;
}

export function formatLogTitle(log: DetailedLog): string {
  const icon = log.success ? '✅' : '❌';
  const title = `${icon} [${log.index}] ${log.keyword}`;
  return boxLine(title);
}

export function formatBasicInfo(log: DetailedLog): string[] {
  const search = sliceDisplay(log.searchQuery, 25);
  const restaurant = sliceDisplay(log.restaurantName || '-', 18);
  const vendor = sliceDisplay(log.vendorTarget || '-', 25);
  const time = `${log.processingTime}ms`;

  return [
    `├${LINE}┤`,
    boxLine(`검색: ${padEndDisplay(search, 25)}  업장: ${restaurant}`),
    boxLine(`타겟: ${padEndDisplay(vendor, 25)}  시간: ${time}`),
  ];
}

export function formatParsingResult(log: DetailedLog): string[] {
  if (log.totalItemsParsed === 0) return [];

  const typeDesc = log.htmlStructure.isPopular
    ? '인기글'
    : `스블 (${log.htmlStructure.uniqueGroups}개)`;

  const lines = [
    `├${LINE}┤`,
    boxLine(`📋 파싱: ${log.totalItemsParsed}  타입: ${typeDesc}  후보: ${log.allMatchesCount}  가용: ${log.availableMatchesCount}`),
  ];

  if (
    !log.htmlStructure.isPopular &&
    log.htmlStructure.topicNames &&
    log.htmlStructure.topicNames.length > 0
  ) {
    const topics = log.htmlStructure.topicNames.join(', ');
    const maxTopicWidth = BOX_WIDTH - 10;
    const displayTopics = getDisplayWidth(topics) > maxTopicWidth
      ? sliceDisplay(topics, maxTopicWidth - 3) + '...'
      : topics;
    lines.push(boxLine(`주제: ${displayTopics}`));
  }

  return lines;
}

export function formatMatchedPost(log: DetailedLog): string[] {
  if (!log.success || !log.matchedPost) {
    return [];
  }

  const mp = log.matchedPost;
  const blog = sliceDisplay(mp.blogName, 18);
  const topic = sliceDisplay(mp.topicName || '-', 15);
  const title = sliceDisplay(mp.postTitle, 55);
  const vendor = sliceDisplay(mp.extractedVendor || '-', 50);

  return [
    `├${LINE}┤`,
    boxLine(`🎯 매칭: ${log.matchSource || '-'}`),
    boxLine(`   블로그: ${padEndDisplay(blog, 18)}  순위: ${mp.position}위  주제: ${topic}`),
    boxLine(`   제목: ${title}`),
    boxLine(`   업장명: ${vendor}`),
  ];
}

export function formatVendorMatchDetails(log: DetailedLog): string[] {
  if (!log.vendorMatchDetails) {
    return [];
  }

  const vmd = log.vendorMatchDetails;
  const baseBrand = sliceDisplay(vmd.baseBrand, 18);
  const brandRoot = sliceDisplay(vmd.brandRoot || '-', 18);
  const matchedBy = sliceDisplay(vmd.matchedBy, 22);

  return [
    boxLine(`   ├─ VENDOR 상세`),
    boxLine(`   │  baseBrand: ${padEndDisplay(baseBrand, 18)}  brandRoot: ${brandRoot}`),
    boxLine(`   │  조건: ${padEndDisplay(matchedBy, 22)}  순서: ${vmd.checkIndex + 1}번째`),
  ];
}

export function formatTitleMatchDetails(log: DetailedLog): string[] {
  if (!log.titleMatchDetails) {
    return [];
  }

  const tmd = log.titleMatchDetails;
  const tokens = sliceDisplay(tmd.tokensUsed.join(', '), 40);

  return [
    boxLine(`   ├─ TITLE 상세`),
    boxLine(`   │  토큰: ${padEndDisplay(tokens, 40)}  필요: ${tmd.tokensRequired}개`),
  ];
}

export function formatFailureReason(log: DetailedLog): string[] {
  if (log.success || !log.failureReason) {
    return [];
  }

  const reason = sliceDisplay(log.failureReason, 60);

  return [
    `├${LINE}┤`,
    boxLine(`⚠️  ${reason}`),
  ];
}

export function formatGuestRetryComparison(log: DetailedLog): string[] {
  if (!log.guestRetryComparison) {
    return [];
  }

  const grc = log.guestRetryComparison;
  const lines: string[] = [
    `├${LINE}┤`,
    boxLine(`🔄 비로그인 재시도: ${grc.recovered ? '복구 성공 ✅' : '복구 실패 ❌'}`),
    boxLine(`   로그인: ${grc.loginMatchCount}개  비로그인: ${grc.guestMatchCount}개  신규: ${grc.newMatchCount}개`),
  ];

  // 로그인/비로그인 주제 비교
  if (grc.loginTopics && grc.loginTopics.length > 0) {
    const loginTopicsStr = sliceDisplay(grc.loginTopics.join(', '), 55);
    lines.push(boxLine(`   로그인 주제: ${loginTopicsStr}`));
  }
  if (grc.guestTopics && grc.guestTopics.length > 0) {
    const guestTopicsStr = sliceDisplay(grc.guestTopics.join(', '), 55);
    lines.push(boxLine(`   비로그인 주제: ${guestTopicsStr}`));
  }

  // 차이점만 표시
  if (grc.onlyInGuest && grc.onlyInGuest.length > 0) {
    const onlyGuest = sliceDisplay(grc.onlyInGuest.join(', '), 50);
    lines.push(boxLine(`   비로그인만: ${onlyGuest}`));
  }

  if (grc.newPosts && grc.newPosts.length > 0 && grc.newPosts.length <= 3) {
    lines.push(boxLine(`   신규 포스트:`));
    grc.newPosts.forEach((p, idx) => {
      const blog = sliceDisplay(p.blogName, 12);
      const title = sliceDisplay(p.postTitle, 35);
      lines.push(boxLine(`     ${idx + 1}. ${blog} "${title}"`));
    });
  }

  return lines;
}

export function formatLogEntry(log: DetailedLog): string[] {
  const lines: string[] = [];

  lines.push('');
  lines.push(formatLogSeparator());
  lines.push(formatLogTitle(log));
  lines.push(...formatBasicInfo(log));
  lines.push(...formatParsingResult(log));
  lines.push(...formatMatchedPost(log));
  lines.push(...formatVendorMatchDetails(log));
  lines.push(...formatTitleMatchDetails(log));
  lines.push(...formatGuestRetryComparison(log));
  lines.push(...formatFailureReason(log));
  lines.push(`└${LINE}┘`);

  return lines;
}

// 요약 박스 라인 (║ 사용)
const summaryLine = (content: string, width: number = BOX_WIDTH): string => {
  const contentWidth = getDisplayWidth(content);
  const padding = Math.max(0, width - contentWidth - 2);
  return `║ ${content}${' '.repeat(padding)}║`;
};

export function formatLogFooter(logs: DetailedLog[]): string[] {
  const failLogs = logs.filter(l => !l.success);

  // 실패 요약
  const failReasons = new Map<string, number>();
  failLogs.forEach(log => {
    const reason = log.failureReason || '알 수 없음';
    failReasons.set(reason, (failReasons.get(reason) || 0) + 1);
  });

  const lines = [
    '',
    `╔${DOUBLE_LINE}╗`,
    summaryLine(`📈 요약`),
    `╠${DOUBLE_LINE}╣`,
  ];

  if (failReasons.size > 0) {
    lines.push(summaryLine(`실패 원인 분석:`));
    Array.from(failReasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([reason, count]) => {
        const shortReason = sliceDisplay(reason, 50);
        lines.push(summaryLine(`  • ${padEndDisplay(shortReason, 50)} ${count}건`));
      });
  }

  // 검색어별 처리
  const searchQueryStats = new Map<string, { success: number; total: number }>();
  logs.forEach(log => {
    const stats = searchQueryStats.get(log.searchQuery) || { success: 0, total: 0 };
    stats.total++;
    if (log.success) stats.success++;
    searchQueryStats.set(log.searchQuery, stats);
  });

  lines.push(`╠${DOUBLE_LINE}╣`);
  lines.push(summaryLine(`검색어별 처리:`));

  const sortedQueries = Array.from(searchQueryStats.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  sortedQueries.forEach(([query, stats]) => {
    const rate = Math.round((stats.success / stats.total) * 100);
    const shortQuery = sliceDisplay(query, 22);
    lines.push(summaryLine(`  • ${padEndDisplay(shortQuery, 22)} ${stats.success}/${stats.total} (${rate}%)`));
  });

  lines.push(`╚${DOUBLE_LINE}╝`);
  lines.push('');

  return lines;
}

export function formatDetailedLogs(
  logs: DetailedLog[],
  elapsedTimeStr: string
): string {
  const lines: string[] = [];

  lines.push(...formatLogHeader(logs, elapsedTimeStr));
  logs.forEach((log) => {
    lines.push(...formatLogEntry(log));
  });
  lines.push(...formatLogFooter(logs));

  return lines.join('\n');
}
