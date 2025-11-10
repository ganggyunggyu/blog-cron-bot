import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllKeywords,
  updateKeywordResult,
} from './database';
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
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  const keywords = await getAllKeywords();
  console.log(`📋 검색어 ${keywords.length}개 처리 예정\n`);

  const allResults: ExposureResult[] = [];
  const usedCombinations = new Set<string>();

  for (let i = 0; i < keywords.length; i++) {
    const keywordDoc = keywords[i];
    const query = keywordDoc.keyword;

    try {
      const html = await crawlWithRetry(query, config.maxRetries);
      const items = extractPopularItems(html);
      const allMatches = matchBlogs(query, items);

      const availableMatches = allMatches.filter((match) => {
        const combination = `${query}:${match.postTitle}`;
        return !usedCombinations.has(combination);
      });

      if (availableMatches.length > 0) {
        const firstMatch = availableMatches[0];
        const combination = `${query}:${firstMatch.postTitle}`;
        usedCombinations.add(combination);

        console.log(`[${i + 1}/${keywords.length}] ${query} ✅`);

        await updateKeywordResult(
          String(keywordDoc._id),
          true,
          firstMatch.topicName || firstMatch.exposureType,
          firstMatch.postLink
        );

        allResults.push(firstMatch);
      } else {
        console.log(`[${i + 1}/${keywords.length}] ${query} ❌`);

        await updateKeywordResult(String(keywordDoc._id), false, '', '');
      }

      if (i < keywords.length - 1) {
        await delay(config.delayBetweenQueries);
      }
    } catch (error) {
      console.log(`[${i + 1}/${keywords.length}] ${query} ❌ (에러)`);
      await updateKeywordResult(String(keywordDoc._id), false, '', '');
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
  console.log(
    `✅ 인기글: ${
      allResults.filter((r) => r.exposureType === '인기글').length
    }개`
  );
  console.log(
    `✅ 스블: ${allResults.filter((r) => r.exposureType === '스블').length}개`
  );
  console.log('='.repeat(50) + '\n');

  await disconnectDB();
}

main().catch((error) => {
  console.error('❌ 프로그램 오류:', error);
  process.exit(1);
});
