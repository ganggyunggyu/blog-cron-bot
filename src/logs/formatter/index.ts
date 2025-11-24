import { DetailedLog } from '../../types';

export function formatLogHeader(
  logs: DetailedLog[],
  elapsedTimeStr: string
): string[] {
  return [
    '='.repeat(80),
    '노출 검출 상세 로그',
    `생성 시간: ${new Date().toLocaleString('ko-KR')}`,
    `총 처리: ${logs.length}개`,
    `성공: ${logs.filter((l) => l.success).length}개`,
    `실패: ${logs.filter((l) => !l.success).length}개`,
    `전체 처리 시간: ${elapsedTimeStr}`,
    '='.repeat(80),
    '',
  ];
}

export function formatLogSeparator(): string {
  return '-'.repeat(80);
}

export function formatLogTitle(log: DetailedLog): string {
  return `[${log.index}] ${log.keyword} ${log.success ? '✅' : '❌'}`;
}

export function formatBasicInfo(log: DetailedLog): string[] {
  return [
    `검색어: ${log.keyword}`,
    `실제 검색: ${log.searchQuery}`,
    `업장명: ${log.restaurantName || '-'}`,
    `타겟: ${log.vendorTarget || '-'}`,
    `결과: ${log.success ? '✅ 노출 인정' : '❌ 노출 없음'}`,
    `처리 시간: ${log.processingTime}ms`,
    '',
  ];
}

export function formatParsingResult(log: DetailedLog): string[] {
  const typeDesc = log.htmlStructure.isPopular
    ? '인기글 (단일 그룹)'
    : `스블 (${log.htmlStructure.uniqueGroups}개 주제)`;

  const lines = [
    '[파싱 결과]',
    `  - 총 아이템: ${log.totalItemsParsed}개`,
    `  - 타입: ${typeDesc}`,
  ];

  if (
    !log.htmlStructure.isPopular &&
    log.htmlStructure.topicNames &&
    log.htmlStructure.topicNames.length > 0
  ) {
    lines.push(`  - 주제 목록: ${log.htmlStructure.topicNames.join(', ')}`);
  }

  lines.push(
    `  - 매칭 후보: ${log.allMatchesCount}개`,
    `  - 사용 가능: ${log.availableMatchesCount}개 (중복 제거 후)`,
    ''
  );

  return lines;
}

export function formatMatchedPost(log: DetailedLog): string[] {
  if (!log.success || !log.matchedPost) {
    return [];
  }

  return [
    '[매칭된 포스트]',
    `  - 블로그: ${log.matchedPost.blogName} (${log.matchedPost.blogId})`,
    `  - 제목: ${log.matchedPost.postTitle}`,
    `  - 링크: ${log.matchedPost.postLink}`,
    `  - 순위: ${log.matchedPost.position}위`,
    `  - 주제: ${log.matchedPost.topicName || '-'}`,
    `  - 노출: ${log.matchedPost.exposureType}`,
    `  - 추출 업장명: ${log.matchedPost.extractedVendor || '-'}`,
    `  - 매칭 방식: ${log.matchSource || '-'}`,
    '',
  ];
}

export function formatVendorMatchDetails(log: DetailedLog): string[] {
  if (!log.vendorMatchDetails) {
    return [];
  }

  const { vendorMatchDetails: vmd } = log;

  return [
    '[VENDOR 매칭 상세]',
    `  - 타겟 업장명: ${vmd.restaurantName}`,
    `  - baseBrand: ${vmd.baseBrand}`,
    `  - brandRoot: ${vmd.brandRoot}`,
    `  - 추출된 업장명: ${vmd.extractedVendor}`,
    `  - 매칭 조건: ${vmd.matchedBy}`,
    `    * rnNorm: ${vmd.rnNorm}`,
    `    * baseBrandNorm: ${vmd.baseBrandNorm}`,
    `  - 체크 순서: ${vmd.checkIndex + 1}번째`,
    '',
  ];
}

export function formatTitleMatchDetails(log: DetailedLog): string[] {
  if (!log.titleMatchDetails) {
    return [];
  }

  const { titleMatchDetails: tmd } = log;

  return [
    '[TITLE 매칭 상세]',
    `  - 사용된 토큰: ${tmd.tokensUsed.join(', ')}`,
    `  - 필요 토큰 수: ${tmd.tokensRequired}개`,
    '',
  ];
}

export function formatFailureReason(log: DetailedLog): string[] {
  if (log.success || !log.failureReason) {
    return [];
  }

  return ['[실패 원인]', `  ${log.failureReason}`, ''];
}

export function formatLogEntry(log: DetailedLog): string[] {
  const lines: string[] = [];

  lines.push(formatLogSeparator());
  lines.push(formatLogTitle(log));
  lines.push(formatLogSeparator());
  lines.push(...formatBasicInfo(log));
  lines.push(...formatParsingResult(log));
  lines.push(...formatMatchedPost(log));
  lines.push(...formatVendorMatchDetails(log));
  lines.push(...formatTitleMatchDetails(log));
  lines.push(...formatFailureReason(log));
  lines.push('');

  return lines;
}

export function formatLogFooter(): string[] {
  return ['='.repeat(80), '로그 종료', '='.repeat(80)];
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
  lines.push(...formatLogFooter());

  return lines.join('\n');
}
