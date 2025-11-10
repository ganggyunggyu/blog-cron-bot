import { connectDB, disconnectDB, getAllKeywords } from './database';
import * as dotenv from 'dotenv';

dotenv.config();

async function testMongoDBFetch() {
  console.log('🚀 MongoDB 데이터 가져오기 테스트\n');

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다');
    }

    await connectDB(uri);

    const keywords = await getAllKeywords();

    console.log(`\n📊 총 ${keywords.length}개 키워드 발견\n`);

    if (keywords.length > 0) {
      console.log('📝 키워드 목록:\n');
      keywords.forEach((kw, idx) => {
        console.log(`${idx + 1}. ${kw.keyword}`);
        console.log(`   회사: ${kw.company}`);
        console.log(`   노출 여부: ${kw.visibility ? '✅ 노출됨' : '❌ 노출 안됨'}`);
        console.log(`   인기주제: ${kw.popularTopic || '(없음)'}`);
        console.log(`   URL: ${kw.url || '(없음)'}`);
        console.log(`   시트타입: ${kw.sheetType}`);
        console.log(`   마지막 체크: ${kw.lastChecked.toLocaleString('ko-KR')}`);
        console.log('');
      });
    }

    await disconnectDB();

    console.log('✅ 테스트 완료!');
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

testMongoDBFetch();
