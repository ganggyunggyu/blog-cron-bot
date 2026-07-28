import * as dotenv from 'dotenv';
import { finalizeDistributedOldLogicMore } from '../lib/distributed-exposure/more-finalizer';
import { logger } from '../lib/logger';

dotenv.config();

type MoreTarget = 'package' | 'general' | 'dogmaru';

const parseTarget = (): MoreTarget => {
  const target = process.argv
    .slice(2)
    .find((value) => value.startsWith('--target='))
    ?.replace('--target=', '');
  if (target === 'package' || target === 'general' || target === 'dogmaru') {
    return target;
  }
  throw new Error('--target=package|general|dogmaru 가 필요합니다.');
};

const main = async (): Promise<void> => {
  const target = parseTarget();
  const result = await finalizeDistributedOldLogicMore(target, '후처리 단독 실행');
  logger.summary.complete(`${target} 더보기 내보내기 완료`, [
    { label: '결과 행', value: `${result.resultRows}개` },
    { label: '노출', value: `${result.exposedKeywords}/${result.totalKeywords}` },
    { label: 'CSV', value: result.csvPath },
  ]);
};

main().catch((error) => {
  logger.error(`더보기 내보내기 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
