import * as dotenv from 'dotenv';
import {
  connectDB,
  disconnectDB,
  getAllKeywords,
  updateKeywordResult,
} from './database';
import { crawlWithRetry, delay, fetchHtml } from './crawler';
import * as cheerio from 'cheerio';
import { extractPopularItems } from './parser';
import { matchBlogs, ExposureResult } from './matcher';
import { saveToCSV } from './csv-writer';
import { getSheetOptions, normalizeSheetType } from './sheet-config';

import { getSearchQuery } from './utils';
import { formatDetailedLogs } from './logs';
import {
  Config,
  DetailedLog,
  VendorMatchDetails,
  TitleMatchDetails,
  MatchedPostInfo,
} from './types';
import { NAVER_DESKTOP_HEADERS } from './constants';

dotenv.config();

const config: Config = {
  maxRetries: 3,
  delayBetweenQueries: 100,
};

function saveDetailedLogs(
  logs: DetailedLog[],
  timestamp: string,
  elapsedTimeStr: string
): void {
  const fs = require('fs');
  const path = require('path');

  // logs 디렉토리 생성
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // JSON 저장
  const jsonPath = path.join(logsDir, `detailed-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(logs, null, 2), 'utf-8');
  console.log(`\n📄 JSON 로그 저장: ${jsonPath}`);

  // TXT 저장 (사람이 읽기 쉬운 형태)
  const txtPath = path.join(logsDir, `detailed-${timestamp}.txt`);
  const formattedLog = formatDetailedLogs(logs, elapsedTimeStr);
  fs.writeFileSync(txtPath, formattedLog, 'utf-8');
  console.log(`📄 TXT 로그 저장: ${txtPath}`);
}

export async function main() {
  const startTime = Date.now();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  await connectDB(mongoUri);

  const allKeywords = await getAllKeywords();

  const onlySheetType = (process.env.ONLY_SHEET_TYPE || '').trim();
  const onlyCompany = (process.env.ONLY_COMPANY || '').trim();
  const onlyKeywordRegex = (process.env.ONLY_KEYWORD_REGEX || '').trim();
  const onlyId = (process.env.ONLY_ID || '').trim();

  let filtered = allKeywords;
  const normalize = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');
  if (onlySheetType)
    filtered = filtered.filter(
      (k: any) => normalize(k.sheetType) === normalize(onlySheetType)
    );
  if (onlyCompany)
    filtered = filtered.filter(
      (k: any) => normalize(k.company) === normalize(onlyCompany)
    );
  if (onlyKeywordRegex) {
    try {
      const re = new RegExp(onlyKeywordRegex);
      filtered = filtered.filter((k: any) => re.test(k.keyword));
    } catch {}
  }
  if (onlyId) {
    filtered = filtered.filter((k: any) => String(k._id) === onlyId);
  }

  const startIndexRaw = Number(process.env.START_INDEX ?? '0');
  const startIndex = Number.isFinite(startIndexRaw)
    ? Math.max(0, Math.min(startIndexRaw, filtered.length))
    : 0;

  const keywords = filtered.slice(startIndex);
  console.log(
    `📋 검색어 ${keywords.length}개 처리 예정 (필터 applied, start=${startIndex})\n`
  );

  const allResults: ExposureResult[] = [];
  const detailedLogs: DetailedLog[] = [];

  // 1️⃣ 크롤링 캐시 및 매칭 큐 (searchQuery별)
  const crawlCache = new Map<string, string>(); // searchQuery -> html
  const matchQueueMap = new Map<string, ExposureResult[]>(); // searchQuery -> 매칭 큐
  const itemsCache = new Map<string, any[]>(); // searchQuery -> items
  const htmlStructureCache = new Map<
    string,
    { isPopular: boolean; uniqueGroups: number; topicNames: string[] }
  >(); // searchQuery -> 구조 정보

  console.log(`\n🔍 총 ${keywords.length}개 키워드 처리\n`);

  // 2️⃣ 키워드를 원래 순서대로 하나씩 처리
  let globalIndex = 0;
  for (const keywordDoc of keywords) {
    const query = keywordDoc.keyword;
    const searchQuery = getSearchQuery(query || '');
    globalIndex++;
    const keywordStartTime = Date.now();

    // ⚠️ 프로그램 제외 대상 체크 (크롤링 전 스킵)
    const restaurantName =
      String((keywordDoc as any).restaurantName || '').trim() ||
      (() => {
        const m = (query || '').match(/\(([^)]+)\)/);
        return m ? m[1].trim() : '';
      })();

    const company = String((keywordDoc as any).company || '').trim();
    const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
    if (normalizedCompany.includes('프로그램')) {
      console.log(
        `[${globalIndex}/${keywords.length}] ${query} ⏭️  ${company} - 프로그램 제외 대상 (스킵)`
      );

      await updateKeywordResult(
        String(keywordDoc._id),
        false,
        '',
        '',
        restaurantName,
        '',
        '',
        undefined,
        ''
      );

      detailedLogs.push({
        index: globalIndex,
        keyword: query,
        searchQuery,
        restaurantName,
        vendorTarget: '',
        success: false,
        totalItemsParsed: 0,
        htmlStructure: { isPopular: false, uniqueGroups: 0, topicNames: [] },
        allMatchesCount: 0,
        availableMatchesCount: 0,
        failureReason: '프로그램 제외 대상',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - keywordStartTime,
      });

      continue;
    }

    // 3️⃣ 이미 크롤링했는지 확인
    let items: any[];
    let allMatches: ExposureResult[];
    let isPopular: boolean;
    let uniqueGroupsSize: number;
    let topicNamesArray: string[] = [];

    if (!crawlCache.has(searchQuery)) {
      // 첫 크롤링
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔎 [신규 크롤링] 검색어: "${searchQuery}"`);
      console.log('='.repeat(60));

      const sheetOpts = getSheetOptions((keywordDoc as any).sheetType);

      try {
        const html = await crawlWithRetry(searchQuery, config.maxRetries);
        items = extractPopularItems(html);

        // Per-sheet option with env override
        const allowAnyEnv = String(
          process.env.ALLOW_ANY_BLOG || ''
        ).toLowerCase();
        const allowAnyBlog =
          allowAnyEnv === 'true'
            ? true
            : allowAnyEnv === '1'
            ? true
            : allowAnyEnv === 'false'
            ? false
            : allowAnyEnv === '0'
            ? false
            : !!sheetOpts.allowAnyBlog;

        allMatches = matchBlogs(query, items, { allowAnyBlog });
        console.log(
          `[CRAWL] 파싱: ${items.length}개 → 매칭: ${allMatches.length}개`
        );

        // Check if it's popular (single group) or smart blog (multiple groups)
        const uniqueGroups = new Set(items.map((item) => item.group));
        isPopular = uniqueGroups.size === 1;
        uniqueGroupsSize = uniqueGroups.size;
        const topicNamesArray = Array.from(uniqueGroups);
        const topicNamesStr = topicNamesArray.join(', ');
        console.log(
          `[TYPE] ${
            isPopular ? '인기글 (단일 그룹)' : `스블 (${topicNamesStr})`
          }`
        );

        // 캐시에 저장
        crawlCache.set(searchQuery, html);
        itemsCache.set(searchQuery, items);
        matchQueueMap.set(searchQuery, [...allMatches]);
        htmlStructureCache.set(searchQuery, {
          isPopular,
          uniqueGroups: uniqueGroupsSize,
          topicNames: topicNamesArray,
        });

        console.log(`[QUEUE] 초기 큐 크기: ${allMatches.length}개\n`);

        await delay(config.delayBetweenQueries);
      } catch (error) {
        console.error(
          `\n❌ 검색어 "${searchQuery}" 크롤링 에러:`,
          (error as Error).message
        );

        const restaurantName =
          String((keywordDoc as any).restaurantName || '').trim() ||
          (() => {
            const m = (query || '').match(/\(([^)]+)\)/);
            return m ? m[1].trim() : '';
          })();

        console.log(
          `[${globalIndex}/${keywords.length}] ${query} ❌ ${
            restaurantName || '-'
          } / - / - / - / - (크롤링 에러)`
        );

        await updateKeywordResult(
          String(keywordDoc._id),
          false,
          '',
          '',
          restaurantName,
          '',
          '',
          undefined,
          ''
        );

        detailedLogs.push({
          index: globalIndex,
          keyword: query,
          searchQuery,
          restaurantName,
          vendorTarget: '',
          success: false,
          totalItemsParsed: 0,
          htmlStructure: { isPopular: false, uniqueGroups: 0, topicNames: [] },
          allMatchesCount: 0,
          availableMatchesCount: 0,
          failureReason: `크롤링 에러: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - keywordStartTime,
        });

        continue;
      }
    } else {
      // 캐시 사용
      console.log(
        `\n[${globalIndex}/${keywords.length}] 🔄 캐시 사용: "${searchQuery}"`
      );
      items = itemsCache.get(searchQuery)!;
      const structure = htmlStructureCache.get(searchQuery)!;
      isPopular = structure.isPopular;
      uniqueGroupsSize = structure.uniqueGroups;
      topicNamesArray = structure.topicNames;
    }

    // 4️⃣ 큐 가져오기
    const matchQueue = matchQueueMap.get(searchQuery)!;
    const allMatchesCount = matchQueue.length; // 현재 남은 큐 크기

    // (restaurantName은 위에서 이미 추출됨)

    // vendorTarget 계산
    const companyRaw = String((keywordDoc as any).company || '').trim();
    const sheetTypeCanon = normalizeSheetType(
      (keywordDoc as any).sheetType || ''
    );
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const companyNorm = norm(companyRaw);
    const vendorBrand = companyNorm.includes(norm('서리펫'))
      ? '서리펫'
      : sheetTypeCanon === 'dogmaru'
      ? '도그마루'
      : '';
    // 서리펫/도그마루도 식당명이랑 동일하게: restaurantName(괄호) 우선, 없으면 업체명(vendorBrand)
    const vendorTarget = restaurantName || vendorBrand;

    // 5️⃣ 큐가 비었으면 바로 실패 처리
    if (matchQueue.length === 0) {
      console.log(
        `[${globalIndex}/${keywords.length}] ${query} ❌ ${
          restaurantName || '-'
        } / - / - / - / - (큐 소진)`
      );

      await updateKeywordResult(
        String(keywordDoc._id),
        false,
        '',
        '',
        restaurantName,
        '',
        '',
        undefined,
        ''
      );

      detailedLogs.push({
        index: globalIndex,
        keyword: query,
        searchQuery,
        restaurantName,
        vendorTarget,
        success: false,
        totalItemsParsed: items.length,
        htmlStructure: {
          isPopular,
          uniqueGroups: uniqueGroupsSize,
          topicNames: topicNamesArray,
        },
        allMatchesCount: 0,
        availableMatchesCount: 0,
        failureReason: '매칭 큐 소진 (이전 키워드에 모두 할당됨)',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - keywordStartTime,
      });

      continue;
    }

    // 6️⃣ 큐에서 필터링 통과하는 첫 번째 찾기
    let matchedIndex = -1;
    let nextMatch: ExposureResult | undefined;
    let passed = false;
    let matchSource: 'VENDOR' | 'TITLE' | '' = '';
    let matchedHtml = '';
    let extractedVendor = '';
    let vendorMatchDetails: VendorMatchDetails | undefined;

    // 7️⃣ 큐를 순회하면서 vendorTarget/TITLE 필터링 통과하는 걸 찾기
    for (let queueIdx = 0; queueIdx < matchQueue.length; queueIdx++) {
      const candidate = matchQueue[queueIdx];
      let candidatePassed = false;
      let candidateSource: 'VENDOR' | 'TITLE' | '' = '';
      let candidateHtml = '';
      let candidateVendor = '';
      let candidateVendorDetails: VendorMatchDetails | undefined;

      if (vendorTarget) {
        // VENDOR 체크
        try {
          candidateHtml = await fetchResolvedPostHtml(candidate.postLink);
          candidateVendor = extractPostVendorName(candidateHtml);

          if (candidateVendor) {
            const normalize = (s: string) =>
              s.toLowerCase().replace(/\s+/g, '');
            const rnNorm = normalize(vendorTarget);
            const baseBrand = vendorTarget
              .replace(/(본점|지점)$/u, '')
              .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
              .trim();
            const baseBrandNorm = normalize(baseBrand);
            const brandRoot = normalize(
              (restaurantName.split(/\s+/)[0] || '').trim()
            );
            const vNorm = normalize(candidateVendor);

            const check1 = vNorm.includes(rnNorm);
            const check2 =
              baseBrandNorm.length >= 2 && vNorm.includes(baseBrandNorm);
            const check3 = brandRoot.length >= 2 && vNorm.includes(brandRoot);

            if (check1 || check2 || check3) {
              candidatePassed = true;
              candidateSource = 'VENDOR';
              candidateVendorDetails = {
                restaurantName: vendorTarget,
                baseBrand,
                brandRoot,
                extractedVendor: candidateVendor,
                matchedBy: check1
                  ? 'rnNorm'
                  : check2
                  ? 'baseBrandNorm'
                  : 'brandRoot',
                checkIndex: queueIdx,
                rnNorm,
                baseBrandNorm,
              };
            }
          }
        } catch (err) {
          console.warn(
            `  [VENDOR 체크 실패 (큐 ${queueIdx})] ${(err as Error).message}`
          );
        }

        // VENDOR 실패 시 TITLE 체크
        if (!candidatePassed) {
          const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
          const titleRaw = candidate.postTitle || '';
          const title = titleRaw.toLowerCase();
          const titleNorm = normalize(titleRaw);
          const rn = vendorTarget.toLowerCase();
          const rnNorm = normalize(vendorTarget);
          const baseBrand = vendorTarget
            .replace(/(본점|지점)$/u, '')
            .replace(/[\p{Script=Hangul}]{1,4}점$/u, '')
            .trim();
          const baseBrandNorm = normalize(baseBrand);
          const brandRoot = normalize(
            (restaurantName.split(/\s+/)[0] || '').trim()
          );

          const hasFull = title.includes(rn) || titleNorm.includes(rnNorm);
          const hasBrand =
            (baseBrandNorm.length >= 2 && titleNorm.includes(baseBrandNorm)) ||
            (brandRoot.length >= 2 && titleNorm.includes(brandRoot));

          if (hasFull || hasBrand) {
            candidatePassed = true;
            candidateSource = 'TITLE';
          }
        }
      } else {
        // vendorTarget 없는 경우: 일반 키워드 → 기본 노출 (매칭만 되면 성공!)
        candidatePassed = true;
        candidateSource = 'TITLE';
      }

      // 통과했으면 선택하고 루프 종료
      if (candidatePassed) {
        matchedIndex = queueIdx;
        nextMatch = candidate;
        passed = true;
        matchSource = candidateSource;
        matchedHtml = candidateHtml;
        extractedVendor = candidateVendor;
        vendorMatchDetails = candidateVendorDetails;
        break;
      }
    }

    // 큐에서 제거
    if (matchedIndex >= 0) {
      matchQueue.splice(matchedIndex, 1);
    }

    // 8️⃣ 결과 처리
    if (passed && nextMatch) {
      // HTML 재추출 (vendorTarget 없는 경우)
      if (!vendorTarget && !matchedHtml) {
        try {
          matchedHtml = await fetchResolvedPostHtml(nextMatch.postLink);
          extractedVendor = extractPostVendorName(matchedHtml);
        } catch (_) {}
      }

      const displayRank = nextMatch.position ?? '-';
      const displayTitle = nextMatch.postTitle || '-';
      const displayTopic = nextMatch.topicName || nextMatch.exposureType || '-';
      console.log(
        `[${globalIndex}/${keywords.length}] ${query} ✅ ${
          restaurantName || '-'
        } / ${displayRank} / ${displayTopic} / ${
          extractedVendor || '-'
        } / ${displayTitle} / SRC=${matchSource}`
      );

      await updateKeywordResult(
        String(keywordDoc._id),
        true,
        nextMatch.topicName || nextMatch.exposureType,
        nextMatch.postLink,
        restaurantName,
        nextMatch.postTitle,
        matchedHtml,
        nextMatch.position,
        extractedVendor
      );

      allResults.push(nextMatch);

      detailedLogs.push({
        index: globalIndex,
        keyword: query,
        searchQuery,
        restaurantName,
        vendorTarget,
        success: true,
        matchSource: matchSource || undefined,
        totalItemsParsed: items.length,
        htmlStructure: {
          isPopular,
          uniqueGroups: uniqueGroupsSize,
          topicNames: topicNamesArray,
        },
        allMatchesCount: allMatchesCount + 1, // 사용 전 큐 크기
        availableMatchesCount: matchQueue.length + 1, // +1 for the one we just used
        matchedPost: {
          blogName: nextMatch.blogName,
          blogId: nextMatch.blogId,
          postTitle: nextMatch.postTitle,
          postLink: nextMatch.postLink,
          position: nextMatch.position ?? 0,
          topicName: nextMatch.topicName || '',
          exposureType: nextMatch.exposureType,
          extractedVendor,
        },
        vendorMatchDetails,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - keywordStartTime,
      });
    } else {
      // 필터링 실패
      console.log(
        `[${globalIndex}/${keywords.length}] ${query} ❌ ${
          restaurantName || '-'
        } / - / - / - / - (필터링 실패)`
      );

      await updateKeywordResult(
        String(keywordDoc._id),
        false,
        '',
        '',
        restaurantName,
        '',
        '',
        undefined,
        ''
      );

      detailedLogs.push({
        index: globalIndex,
        keyword: query,
        searchQuery,
        restaurantName,
        vendorTarget,
        success: false,
        totalItemsParsed: items.length,
        htmlStructure: {
          isPopular,
          uniqueGroups: uniqueGroupsSize,
          topicNames: topicNamesArray,
        },
        allMatchesCount: allMatchesCount,
        availableMatchesCount: matchQueue.length,
        failureReason: vendorTarget
          ? 'VENDOR 및 TITLE 필터링 모두 실패'
          : 'TITLE 필터링 실패 (토큰 미포함)',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - keywordStartTime,
      });
    }
  }

  // 🔟 최종 결과 저장

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filterSheet = (process.env.ONLY_SHEET_TYPE || '').trim();
  const csvPrefix = filterSheet
    ? getSheetOptions(filterSheet).csvFilePrefix
    : 'results';
  const filename = `${csvPrefix}_${timestamp}.csv`;

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
  console.log(`✅ 처리 시간: ${elapsedTimeStr}`);
  console.log('='.repeat(50) + '\n');

  // 상세 로그 저장
  saveDetailedLogs(detailedLogs, timestamp, elapsedTimeStr);

  console.log('\n' + '='.repeat(50));
  console.log('📝 상세 로그 저장 완료');
  console.log('='.repeat(50));
  console.log(`✅ 총 로그 엔트리: ${detailedLogs.length}개`);
  console.log(`✅ 성공: ${detailedLogs.filter((l) => l.success).length}개`);
  console.log(`✅ 실패: ${detailedLogs.filter((l) => !l.success).length}개`);
  console.log('='.repeat(50) + '\n');

  await disconnectDB();
}

export function extractPostVendorName(html: string): string {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    // 1) Prefer se-oglink-title first
    const titleText = $('.se-oglink-title').first().text().trim();
    if (titleText) {
      // Exact "네이버 지도" → rely on summary as-is
      if (titleText === '네이버 지도') {
        const summaryText = $('.se-oglink-summary').first().text().trim();
        return summaryText || titleText;
      }
      // Pattern like "가게명 : 네이버" → extract left part
      const m = titleText.match(/^(.+?)\s*:\s*네이버\s*$/);
      if (m) return (m[1] || '').trim();
      // Fallback: split by common delimiters
      const parts = titleText.split(/\s*[:\-]\s*/);
      const head = (parts[0] || '').trim();
      return head || titleText;
    }
    // 2) Fallback to se-map-title
    const mapText = $('.se-map-title').first().text().trim();
    if (!mapText) return '';
    const parts = mapText.split(/\s*[:\-]\s*/);
    const head = (parts[0] || '').trim();
    return head || mapText;
  } catch {
    return '';
  }
}

export async function fetchResolvedPostHtml(url: string): Promise<string> {
  try {
    const outer = await fetchHtml(url, NAVER_DESKTOP_HEADERS);
    // Naver desktop blog often loads content inside #mainFrame iframe
    if (outer && outer.includes('id="mainFrame"')) {
      const $ = cheerio.load(outer);
      const src = $('#mainFrame').attr('src') || '';
      if (src) {
        const abs = new URL(src, url).toString();
        try {
          const inner = await fetchHtml(abs, NAVER_DESKTOP_HEADERS);
          if (containsVendorSelectors(inner)) return inner;
          // fallback to mobile if still not present
          const murl = buildMobilePostUrl(url, abs);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl, NAVER_DESKTOP_HEADERS);
              if (containsVendorSelectors(mhtml)) return mhtml;
            } catch {}
          }
          return inner || outer;
        } catch {
          // try mobile directly
          const murl = buildMobilePostUrl(url, src);
          if (murl) {
            try {
              const mhtml = await fetchHtml(murl, NAVER_DESKTOP_HEADERS);
              if (containsVendorSelectors(mhtml)) return mhtml;
            } catch {}
          }
          return outer;
        }
      }
    }
    // If no iframe, but vendor selector missing, try mobile variant too
    if (!containsVendorSelectors(outer)) {
      const murl = buildMobilePostUrl(url);
      if (murl) {
        try {
          const mhtml = await fetchHtml(murl, NAVER_DESKTOP_HEADERS);
          if (containsVendorSelectors(mhtml)) return mhtml;
        } catch {}
      }
    }
    return outer;
  } catch {
    return '';
  }
}

function containsVendorSelectors(html: string): boolean {
  if (!html) return false;
  try {
    const $ = cheerio.load(html);
    return (
      $('.se-oglink-title').length > 0 ||
      $('.se-oglink-summary').length > 0 ||
      $('.se-map-title').length > 0
    );
  } catch {
    return false;
  }
}

function buildMobilePostUrl(
  originalUrl: string,
  fallbackUrl?: string
): string | null {
  try {
    const candidates = [originalUrl];
    if (fallbackUrl) candidates.push(fallbackUrl);
    for (const u of candidates) {
      const { blogId, logNo } = parseBlogParams(u);
      if (blogId && logNo) {
        return `https://m.blog.naver.com/${blogId}/${logNo}`;
      }
    }
  } catch {}
  return null;
}

function parseBlogParams(u: string): {
  blogId: string | null;
  logNo: string | null;
} {
  try {
    const url = new URL(u, 'https://blog.naver.com');
    // pattern 1: https://blog.naver.com/{blogId}/{logNo}
    const path = url.pathname.replace(/^\/+/, '').split('/');
    if (path.length >= 2 && path[0] !== 'PostView.naver') {
      const blogId = path[0];
      const logNo = path[1];
      if (blogId && logNo) return { blogId, logNo };
    }
    // pattern 2: PostView.naver?blogId=...&logNo=...
    if (url.pathname.includes('PostView.naver')) {
      const blogId = url.searchParams.get('blogId');
      const logNo = url.searchParams.get('logNo');
      return { blogId, logNo };
    }
  } catch {}
  return { blogId: null, logNo: null };
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 프로그램 오류:', error);
    process.exit(1);
  });
}
