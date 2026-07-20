import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getPageCheckKeywords,
  type PageCheckSheetType,
} from './database';
import { processSheetKeywords } from './cron-pages';
import { checkNaverLogin } from './lib/check-naver-login';
import { getExposureConcurrency } from './lib/exposure-run-config';
import { logger } from './lib/logger';
import { closeBrowser } from './lib/playwright-crawler';

dotenv.config();

const parseArgs = (): { target: PageCheckSheetType; keywordIds: Set<string> } => {
  const [targetValue, idsValue] = process.argv.slice(2);
  if (targetValue !== 'pet' && targetValue !== 'suripet') {
    throw new Error('분산 페이지 워커는 pet 또는 suripet만 허용됨');
  }
  const prefix = '--keyword-ids=';
  if (!idsValue?.startsWith(prefix)) throw new Error('keyword ids 누락');
  const keywordIds = new Set(idsValue.slice(prefix.length).split(',').filter(Boolean));
  if (keywordIds.size === 0) throw new Error('빈 keyword ids');
  return { target: targetValue, keywordIds };
};

const main = async (): Promise<void> => {
  const { target, keywordIds } = parseArgs();
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');

  await connectDB(mongoUri);
  try {
    const [loginStatus, allKeywords] = await Promise.all([
      checkNaverLogin(),
      getPageCheckKeywords(target),
    ]);
    const keywords = allKeywords.filter((keyword) =>
      keywordIds.has(String(keyword._id))
    );
    if (keywords.length !== keywordIds.size) {
      throw new Error(`키워드 스냅샷 불일치: ${keywords.length}/${keywordIds.size}`);
    }
    logger.info(`[분산 ${target}] ${keywords.length}개 키워드 조각 처리`);
    await processSheetKeywords(
      target,
      keywords,
      loginStatus.isLoggedIn,
      getExposureConcurrency()
    );
  } finally {
    await closeBrowser();
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`분산 페이지 조각 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
