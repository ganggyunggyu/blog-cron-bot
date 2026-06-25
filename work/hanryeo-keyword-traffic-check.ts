import fs from 'fs';
import path from 'path';
import { extractPopularItems, PopularItem } from '../src/parser';
import { getIsNewLogicFromItems } from '../src/lib/keyword-processor/keyword-classifier';
import {
  closeBrowser,
  crawlSinglePagePlaywright,
} from '../src/lib/playwright-crawler';
import { buildNaverSearchUrl } from '../src/constants/crawl-config';

interface KeywordInput {
  source: string;
  raw_count: number;
  unique_count: number;
  keywords: string[];
  unique_keywords: string[];
}

interface NaverLogicResult {
  keyword: string;
  logic: string;
  exposureType: string;
  topics: string[];
  firstPageItemCount: number;
  totalItemCount: number;
  sampleTitles: string[];
  naverUrl: string;
  checkedAt: string;
  status: string;
  errorMessage?: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getExposureType = (items: PopularItem[]): string => {
  const firstPageItems = items.filter((item) => !item.page || item.page === 1);
  if (firstPageItems.length === 0) return '판정불가';

  const groups = Array.from(
    new Set(firstPageItems.map((item) => item.group).filter(Boolean))
  );

  if (groups.length === 0) return '판정불가';
  return groups.length === 1 ? '인기글' : '스블';
};

const classifyKeyword = async (keyword: string): Promise<NaverLogicResult> => {
  const checkedAt = new Date().toISOString();
  const naverUrl = buildNaverSearchUrl(keyword);

  try {
    const html = await crawlSinglePagePlaywright(keyword);
    const items = extractPopularItems(html);
    const firstPageItems = items.filter((item) => !item.page || item.page === 1);
    const isNewLogic =
      firstPageItems.length > 0 ? getIsNewLogicFromItems(items) : null;
    const topics = Array.from(
      new Set(firstPageItems.map((item) => item.group).filter(Boolean))
    );

    return {
      keyword,
      logic:
        isNewLogic === true ? '신로직' : isNewLogic === false ? '구로직' : '판정불가',
      exposureType: getExposureType(items),
      topics,
      firstPageItemCount: firstPageItems.length,
      totalItemCount: items.length,
      sampleTitles: firstPageItems.slice(0, 3).map((item) => item.title),
      naverUrl,
      checkedAt,
      status: firstPageItems.length > 0 ? 'ok' : 'no-popular-items',
    };
  } catch (error) {
    return {
      keyword,
      logic: '오류',
      exposureType: '오류',
      topics: [],
      firstPageItemCount: 0,
      totalItemCount: 0,
      sampleTitles: [],
      naverUrl,
      checkedAt,
      status: 'error',
      errorMessage: (error as Error).message,
    };
  }
};

const parseArgs = (): { input: string; output: string; limit: number; delayMs: number } => {
  const args = process.argv.slice(2);
  let input = '';
  let output = '';
  let limit = 0;
  let delayMs = 1800;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--input' && next) {
      input = next;
      index += 1;
      continue;
    }

    if (arg === '--output' && next) {
      output = next;
      index += 1;
      continue;
    }

    if (arg === '--limit' && next) {
      limit = Math.max(0, Math.floor(Number(next)));
      index += 1;
      continue;
    }

    if (arg === '--delay-ms' && next) {
      delayMs = Math.max(0, Math.floor(Number(next)));
      index += 1;
      continue;
    }

    throw new Error(`알 수 없는 인자: ${arg}`);
  }

  if (!input || !output) {
    throw new Error('--input, --output 인자가 필요합니다.');
  }

  return { input, output, limit, delayMs };
};

const main = async (): Promise<void> => {
  const { input, output, limit, delayMs } = parseArgs();
  const data = JSON.parse(fs.readFileSync(input, 'utf8')) as KeywordInput;
  const keywords =
    limit > 0 ? data.unique_keywords.slice(0, limit) : data.unique_keywords;
  const results: NaverLogicResult[] = [];

  console.log(
    JSON.stringify({
      event: 'start',
      rawCount: data.raw_count,
      uniqueCount: data.unique_count,
      runCount: keywords.length,
      delayMs,
    })
  );

  for (let index = 0; index < keywords.length; index += 1) {
    const keyword = keywords[index];
    const result = await classifyKeyword(keyword);
    results.push(result);

    console.log(
      JSON.stringify({
        event: 'keyword',
        index: index + 1,
        total: keywords.length,
        keyword,
        logic: result.logic,
        exposureType: result.exposureType,
        topics: result.topics,
        status: result.status,
      })
    );

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          source: data.source,
          rawCount: data.raw_count,
          uniqueCount: data.unique_count,
          completedCount: results.length,
          generatedAt: new Date().toISOString(),
          results,
        },
        null,
        2
      ),
      'utf8'
    );

    if (index + 1 < keywords.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }
};

main()
  .catch((error) => {
    console.error((error as Error).stack || (error as Error).message);
    process.exit(1);
  })
  .finally(async () => {
    await closeBrowser();
  });
