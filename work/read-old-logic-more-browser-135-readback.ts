import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
} from '../src/constants/blog-ids';
import {
  getGoogleSheetAuth,
  openSpreadsheet,
} from '../src/lib/google-sheets/direct-exposure-sheet';

dotenv.config();

const SPREADSHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const LIMIT = 50;

const normalize = (value: unknown): string => String(value ?? '').trim();

const parseRank = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) {
    return null;
  }
  return Number(cleaned);
};

const readReport = async (title: string) => {
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(SPREADSHEET_ID, auth);
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    throw new Error(`${title} 탭을 찾을 수 없음`);
  }

  const rows = await sheet.getRows();
  const parsedRows = rows.map((row, index) => {
    const keyword = normalize(row.get('키워드'));
    const blogId = normalize(row.get('블로그아이디'));
    const rank = parseRank(normalize(row.get('순위')));
    const link = normalize(row.get('링크'));
    const publishedAt = normalize(row.get('작성일자'));
    const status = normalize(row.get('상태'));

    return {
      row: index + 2,
      keyword,
      blogId,
      rank,
      link,
      publishedAt,
      status,
    };
  });

  const exposedRows = parsedRows.filter((row) => row.status === '노출');
  const errorRows = parsedRows.filter((row) => row.status.startsWith('오류'));
  const over50Rows = parsedRows.filter(
    (row) => row.rank !== null && row.rank > LIMIT
  );
  const parenKeywordRows = parsedRows.filter((row) => /[()（）]/.test(row.keyword));
  const importantRows = parsedRows.filter((row) =>
    [
      '프로포즈반지',
      '위고비 알약',
      '광안리 술집',
      '광안리맛집',
      '광안리 맛집',
    ].includes(row.keyword)
  );

  return {
    title,
    targetBlogSet: 'PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS',
    targetBlogCount: PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS.length,
    limit: LIMIT,
    rows: parsedRows.length,
    uniqueKeywords: new Set(parsedRows.map((row) => row.keyword).filter(Boolean))
      .size,
    exposedRows: exposedRows.length,
    exposedKeywords: new Set(exposedRows.map((row) => row.keyword)).size,
    errors: errorRows.length,
    over50: over50Rows.length,
    parenKeywords: parenKeywordRows.length,
    maxRank: Math.max(...parsedRows.map((row) => row.rank ?? 0)),
    importantRows,
    over50Rows,
    errorRows,
  };
};

const main = async (): Promise<void> => {
  const checkedAt = new Date().toISOString();
  const reports = await Promise.all([
    readReport('패키지_더보기'),
    readReport('일반건_더보기'),
  ]);
  const output = {
    sheetId: SPREADSHEET_ID,
    checkedAt,
    reports,
  };
  const outputPath = path.join(
    process.cwd(),
    'output',
    `old-logic-more-package-general-top50-browser-135-readback-${checkedAt.replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
