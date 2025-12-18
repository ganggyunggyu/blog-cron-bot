import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllRootKeywords,
  updateRootKeywordResult,
  IRootKeyword,
} from './database';
import { saveToCSV } from './csv-writer';
import { createDetailedLogBuilder, saveDetailedLogs } from './logs';
import { processKeywords } from './lib/keyword-processor';
import { ROOT_CONFIG, SHEET_APP_URL } from './constants';
import { checkNaverLogin } from './lib/check-naver-login';
import axios from 'axios';

dotenv.config();

export async function main() {
  const startTime = Date.now();

  // 로그인 상태 확인
  const loginStatus = await checkNaverLogin();
  console.log('='.repeat(50));
  if (loginStatus.isLoggedIn) {
    console.log(`🔐 로그인 모드: ${loginStatus.userName} (${loginStatus.email})`);
  } else {
    console.log('🌐 비로그인 모드');
  }
  console.log('='.repeat(50) + '\n');

  type RootResponseType = { deleted: number; inserted: number };
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    const response = await fetch(`${SHEET_APP_URL}/api/root-keywords/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetId: ROOT_CONFIG.SHEET_ID }),
    });

    const result = (await response.json()) as RootResponseType;
    console.log(
      `DB 동기화 완료! (삭제: ${result.deleted}, 삽입: ${result.inserted})`
    );
  } catch (error) {
    console.error('동기화 에러:', error);
  } finally {
  }

  await connectDB(mongoUri);

  const allKeywords = await getAllRootKeywords();

  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

  let filtered = allKeywords as IRootKeyword[];
  const normalize = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');

  if (onlyCompany)
    filtered = filtered.filter(
      (k) => normalize(k.company) === normalize(onlyCompany)
    );
  if (onlyKeywordRegex) {
    try {
      const re = new RegExp(onlyKeywordRegex);
      filtered = filtered.filter((k) => re.test(k.keyword));
    } catch {}
  }
  if (onlyId) {
    filtered = filtered.filter((k) => String(k._id) === onlyId);
  }

  const startIndexRaw = Number(process.env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexRaw)
    ? Math.max(0, Math.min(startIndexRaw, filtered.length))
    : 0;

  const keywords = filtered.slice(startIndex);
  console.log(
    `📋 루트 키워드 ${keywords.length}개 처리 예정 (필터 applied, start=${startIndex})\n`
  );

  const logBuilder = createDetailedLogBuilder();

  // processKeywords 사용 (updateRootKeywordResult 전달)
  const allResults = await processKeywords(keywords, logBuilder, {
    updateFunction: updateRootKeywordResult,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `root_${timestamp}.csv`;
  saveToCSV(allResults, filename);

  const elapsedMs = Date.now() - startTime;
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
  const elapsedTimeStr =
    hours > 0
      ? `${hours}시간 ${minutes}분 ${seconds}초`
      : minutes > 0
      ? `${minutes}분 ${seconds}초`
      : `${seconds}초`;

  console.log('\n' + '='.repeat(50));
  console.log('📊 루트 키워드 크롤링 완료 요약');
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
  console.log(`✅ 처리 시간: ${elapsedTimeStr}`);
  console.log('='.repeat(50) + '\n');

  const result = await axios.post(`${SHEET_APP_URL}/api/root-keywords/import`);

  console.log(result.data);

  const logs = logBuilder.getLogs();
  saveDetailedLogs(logs, `root_${timestamp}`, elapsedTimeStr);

  console.log('\n' + '='.repeat(50));
  console.log('📝 상세 로그 저장 완료');
  console.log('='.repeat(50));
  const stats = logBuilder.getStats();
  console.log(`✅ 총 로그 엔트리: ${stats.total}개`);
  console.log(`✅ 성공: ${stats.success}개`);
  console.log(`✅ 실패: ${stats.failed}개`);
  console.log('='.repeat(50) + '\n');

  await disconnectDB();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 프로그램 오류:', error);
    process.exit(1);
  });
}
