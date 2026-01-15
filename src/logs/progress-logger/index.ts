import chalk from 'chalk';
import { logger } from '../../lib/logger';

interface ProgressSuccessParams {
  index: number;
  total: number;
  keyword: string;
  restaurantName: string;
  rank: number | string;
  topic: string;
  vendor: string;
  title: string;
  source: string;
  elapsed?: number;
  isCache?: boolean;
  queueBefore?: number;
  queueAfter?: number;
  isGuestRecovered?: boolean;
}

interface ProgressFailureParams {
  index: number;
  total: number;
  keyword: string;
  restaurantName: string;
  reason: string;
  elapsed?: number;
  queueBefore?: number;
  queueAfter?: number;
}

const pad = (n: number, total: number) => {
  const totalLen = String(total).length;
  return String(n).padStart(totalLen);
};

const getTimestamp = () => {
  return chalk.gray(new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }));
};

export const progressLogger = {
  success: (params: ProgressSuccessParams) => {
    const { index, total, keyword, restaurantName, rank, topic, elapsed = 0, isCache, queueBefore, queueAfter, isGuestRecovered } = params;

    const idx = chalk.gray(`[${pad(index, total)}/${total}]`);
    const icon = chalk.green('✓');
    const kw = chalk.white(`"${keyword}"`);
    const arrow = chalk.gray('→');
    const rest = restaurantName ? chalk.cyan(restaurantName.slice(0, 15)) : chalk.gray('-');
    const topicType = topic === '인기글'
      ? chalk.magenta('인기')
      : topic === '스블'
        ? chalk.blue('스블')
        : chalk.blue(topic.slice(0, 20));
    const rankStr = chalk.yellow(`${rank}위`);
    const time = isCache
      ? chalk.gray('캐시')
      : chalk.gray(`${elapsed}ms`);

    // 로그인/비로그인 표시
    const authStr = isGuestRecovered
      ? chalk.bgYellow.black(' 비로그인 ')
      : '';

    // 큐 상태 표시
    const queueStr = queueBefore !== undefined && queueAfter !== undefined
      ? chalk.gray(` │ `) + chalk.dim(`큐 ${queueBefore}→${queueAfter}`)
      : '';

    logger.statusLine.print(`${idx} ${icon} ${kw} ${arrow} ${rest} ${topicType} ${rankStr} ${time}${authStr}${queueStr}`);
  },

  failure: (params: ProgressFailureParams) => {
    const { index, total, keyword, restaurantName, reason, elapsed = 0, queueBefore, queueAfter } = params;

    const idx = chalk.gray(`[${pad(index, total)}/${total}]`);
    const icon = chalk.red('✖');
    const kw = chalk.white(`"${keyword}"`);
    const arrow = chalk.gray('→');
    const rest = restaurantName ? chalk.dim(restaurantName.slice(0, 15)) : '';
    const reasonStr = chalk.red(reason);
    const time = chalk.gray(`${elapsed}ms`);

    // 큐 상태 표시
    const queueStr = queueBefore !== undefined && queueAfter !== undefined
      ? chalk.gray(` │ `) + chalk.dim(`큐 ${queueBefore}→${queueAfter}`)
      : '';

    logger.statusLine.print(`${idx} ${icon} ${kw} ${arrow} ${rest} ${reasonStr} ${time}${queueStr}`);
  },

  skip: (params: { index: number; total: number; keyword: string; company: string }) => {
    const { index, total, keyword, company } = params;

    const idx = chalk.gray(`[${pad(index, total)}/${total}]`);
    const icon = chalk.gray('○');
    const kw = chalk.dim(`"${keyword}"`);
    const arrow = chalk.gray('→');
    const reason = chalk.gray(`${company} 제외`);

    logger.statusLine.print(`${idx} ${icon} ${kw} ${arrow} ${reason}`);
  },

  cacheUsed: (params: { index: number; total: number; searchQuery: string }) => {
    // 캐시 사용 시에는 별도 로그 출력하지 않음 (success에서 처리)
  },

  newCrawl: (searchQuery: string, parsed?: number, matched?: number, type?: string) => {
    logger.statusLine.print('');
    const info = parsed !== undefined
      ? chalk.dim(` (${parsed}→${matched} ${type === '인기글' ? '인기' : '스블'})`)
      : '';
    logger.statusLine.print(`${getTimestamp()} ${chalk.cyan('🔍')} ${chalk.white(searchQuery)}${info}`);
  },

  // 요약 정보 (디버그용, 기본 숨김)
  crawlInfo: (parsed: number, matched: number, type: string) => {
    // newCrawl에서 통합 출력
  },

  retry: (message: string) => {
    logger.statusLine.print(chalk.yellow(`     ↻ ${message}`));
  },

  recovered: (blogName: string) => {
    logger.statusLine.print(chalk.green(`     ✓ 비로그인 복구: ${blogName}`));
  },

  queueChange: (before: number, after: number, action: 'add' | 'init') => {
    const diff = after - before;
    if (action === 'init' && after > 0) {
      // 초기화는 newCrawl에서 통합 표시, 0개일 때만 표시
    } else if (action === 'init' && after === 0) {
      logger.statusLine.print(chalk.dim(`     📥 큐: 0개 (매칭 없음)`));
    } else if (diff > 0) {
      logger.statusLine.print(chalk.cyan(`     📥 +${diff}개 추가 (${before}→${after})`));
    }
  },

  // 로그인/비로그인 주제 비교 (간결한 한 줄 버전)
  topicComparison: (params: {
    loginTopics: string[];
    guestTopics: string[];
    commonTopics: string[];
    onlyInLogin: string[];
    onlyInGuest: string[];
    loginMatches: number;
    guestMatches: number;
    newMatches: number;
  }) => {
    const { loginMatches, guestMatches, newMatches, onlyInLogin, onlyInGuest } = params;

    // 한 줄로 간결하게 표시
    const diff = newMatches > 0 ? chalk.green(`+${newMatches}`) : chalk.dim('0');
    const extra = onlyInGuest.length > 0
      ? chalk.yellow(` (비로그인 전용 주제 ${onlyInGuest.length}개)`)
      : '';

    logger.statusLine.print(
      chalk.gray('     🔄 ') +
      chalk.dim(`로그인 ${loginMatches} → 비로그인 ${guestMatches} `) +
      chalk.white(`신규 ${diff}`) +
      extra
    );
  },

  // 비로그인 재시도 결과
  guestRetryResult: (success: boolean, blogName?: string, newCount?: number) => {
    if (success && blogName) {
      logger.statusLine.print(chalk.green(`     ✅ 복구: ${blogName}`));
    } else if (newCount && newCount > 0) {
      logger.statusLine.print(chalk.yellow(`     ⚠️ +${newCount}개 추가, 매칭 실패`));
    } else {
      logger.statusLine.print(chalk.dim(`     ○ 신규 매칭 없음`));
    }
  },
};
