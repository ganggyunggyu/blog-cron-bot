import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../database';
import { logger } from '../lib/logger';
import { seedLab21Member } from '../lib/tenant/store';

dotenv.config();

const main = async (): Promise<void> => {
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');

  const password = String(process.env.SEED_TENANT_PASSWORD ?? '').trim();
  if (!password) {
    throw new Error('SEED_TENANT_PASSWORD 환경 변수로 비밀번호를 넘겨야 함');
  }

  await connectDB(mongoUri);
  try {
    const member = await seedLab21Member(password);
    const enabled = member.preset.targets.filter(({ enabled }) => enabled);
    logger.success(
      `21lab 계정 준비 완료: ${member.loginId} · 프리셋 대상 ${enabled.length}개`
    );
    enabled.forEach((target) => {
      const result = target.result
        ? `${target.result.tabTitle}`
        : '원본 시트에 반영';
      logger.info(
        `  ${target.label} (${target.kind}) · 읽기 ${target.source.tabTitle} → 쓰기 ${result}`
      );
    });
  } finally {
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`테넌트 시드 실패: ${(error as Error).message}`);
  process.exitCode = 1;
});
