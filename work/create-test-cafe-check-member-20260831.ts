import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/database';
import { createMember, findMemberByLoginId } from '../src/lib/tenant/store';
import { EMPTY_PRESET } from '../src/lib/tenant/preset';

dotenv.config();

const LOGIN_ID = 'cafe-check-test';
const PASSWORD = 'cafeCheckTest2026';

const main = async (): Promise<void> => {
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');

  await connectDB(mongoUri);
  try {
    const existing = await findMemberByLoginId(LOGIN_ID);
    if (existing) {
      console.log('이미 있음:', existing.loginId, existing.id);
      return;
    }
    const member = await createMember({
      loginId: LOGIN_ID,
      password: PASSWORD,
      displayName: '카페체크 UI 테스트',
      preset: EMPTY_PRESET,
    });
    console.log('생성 완료:', member.loginId, member.id);
  } finally {
    await disconnectDB();
  }
};

main().catch((error) => {
  console.error('실패:', (error as Error).message);
  process.exitCode = 1;
});
