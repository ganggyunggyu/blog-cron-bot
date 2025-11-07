import * as dotenv from 'dotenv';
import { connectDB, disconnectDB, getAllKeywords, updateKeywordResult } from './database';
import { crawlWithRetry, delay } from './crawler';
import { extractPopularItems } from './parser';
import { matchBlogs, ExposureResult } from './matcher';
import { saveToCSV } from './csv-writer';

dotenv.config();

interface Config {
  maxRetries: number;
  delayBetweenQueries: number;
}

const config: Config = {
  maxRetries: 3,
  delayBetweenQueries: 2000,
};

async function main() {
  console.log('🚀 네이버 검색 노출 크론 봇 시작\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  const keywords = await getAllKeywords();
  console.log(`📋 검색어 ${keywords.length}개 처리 예정\n`);

  const allResults: ExposureResult[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const keywordDoc = keywords[i];
    const query = keywordDoc.keyword;

    console.log(`\n[${i + 1}/${keywords.length}] "${query}" 검색 시작...`);

    try {
      const html = await crawlWithRetry(query, config.maxRetries);

      const items = extractPopularItems(html);
      console.log(`✅ 인기글 ${items.length}개 추출`);

      const matches = matchBlogs(query, items);

      if (matches.length > 0) {
        console.log(`\n🎯 "${query}" 노출 발견! (${matches.length}개)`);
        matches.forEach(match => {
          console.log(`  - ${match.blogId} (${match.blogName})`);
          console.log(`    타입: ${match.exposureType}`);
          if (match.topicName) {
            console.log(`    주제: ${match.topicName}`);
          }
          console.log(`    순위: ${match.position}위`);
          console.log(`    제목: ${match.postTitle}`);
          console.log('');
        });

        const firstMatch = matches[0];
        await updateKeywordResult(
          keywordDoc._id.toString(),
          true,
          firstMatch.topicName || firstMatch.exposureType,
          firstMatch.postLink
        );
      } else {
        console.log(`❌ "${query}" 노출 없음`);
        await updateKeywordResult(
          keywordDoc._id.toString(),
          false,
          '',
          ''
        );
      }

      allResults.push(...matches);

      if (i < keywords.length - 1) {
        console.log(`⏳ ${config.delayBetweenQueries / 1000}초 대기...`);
        await delay(config.delayBetweenQueries);
      }
    } catch (error) {
      console.error(`❌ "${query}" 처리 실패:`, error);
      await updateKeywordResult(
        keywordDoc._id.toString(),
        false,
        '',
        ''
      );
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `results_${timestamp}.csv`;

  saveToCSV(allResults, filename);

  console.log('\n' + '='.repeat(50));
  console.log('📊 크롤링 완료 요약');
  console.log('='.repeat(50));
  console.log(`✅ 총 검색어: ${keywords.length}개`);
  console.log(`✅ 총 노출 발견: ${allResults.length}개`);
  console.log(`✅ 인기글: ${allResults.filter(r => r.exposureType === '인기글').length}개`);
  console.log(`✅ 스블: ${allResults.filter(r => r.exposureType === '스블').length}개`);
  console.log('='.repeat(50) + '\n');

  await disconnectDB();
}

main().catch(error => {
  console.error('❌ 프로그램 오류:', error);
  process.exit(1);
});
