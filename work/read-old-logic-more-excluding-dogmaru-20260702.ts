import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
  SURI_PET_PAGE_CHECK_BLOG_IDS,
} from '../src/constants/blog-ids';
import {
  getGoogleSheetAuth,
  openSpreadsheet,
} from '../src/lib/google-sheets/direct-exposure-sheet';

dotenv.config();

const SPREADSHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const LIMIT = 50;

const tabs = [
  {
    title: '패키지_더보기',
    targetBlogSet: 'PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS',
    targetBlogCount: PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS.length,
  },
  {
    title: '일반건_더보기',
    targetBlogSet: 'PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS',
    targetBlogCount: PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS.length,
  },
  {
    title: '루트_더보기',
    targetBlogSet: 'OLD_LOGIC_TARGET_BLOG_IDS_WITH_VENDOR_CHECK',
    targetBlogCount: 45,
  },
  {
    title: '서리펫_더보기',
    targetBlogSet: 'SURI_PET_PAGE_CHECK_BLOG_IDS',
    targetBlogCount: SURI_PET_PAGE_CHECK_BLOG_IDS.length,
  },
];

const normalize = (value: unknown): string => String(value ?? '').trim();

const parseRank = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned) : null;
};

const main = async (): Promise<void> => {
  const checkedAt = new Date().toISOString();
  const auth = getGoogleSheetAuth();
  const doc = await openSpreadsheet(SPREADSHEET_ID, auth);

  const reports = [];
  for (const tab of tabs) {
    const sheet = doc.sheetsByTitle[tab.title];
    if (!sheet) {
      throw new Error(`${tab.title} 탭을 찾을 수 없음`);
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
    const moreMissingRows = parsedRows.filter((row) =>
      /더보기 결과 0개/.test(row.status)
    );
    const over50Rows = parsedRows.filter(
      (row) => row.rank !== null && row.rank > LIMIT
    );

    reports.push({
      ...tab,
      limit: LIMIT,
      rows: parsedRows.length,
      uniqueKeywords: new Set(
        parsedRows.map((row) => row.keyword).filter(Boolean)
      ).size,
      exposedRows: exposedRows.length,
      exposedKeywords: new Set(exposedRows.map((row) => row.keyword)).size,
      unexposedOrErrorRows: parsedRows.length - exposedRows.length,
      errors: errorRows.length,
      moreMissing: moreMissingRows.length,
      over50: over50Rows.length,
      maxRank: Math.max(...parsedRows.map((row) => row.rank ?? 0)),
      errorRows,
      moreMissingRows,
      over50Rows,
    });
  }

  const aggregate = reports.reduce(
    (acc, report) => {
      acc.rows += report.rows;
      acc.exposedRows += report.exposedRows;
      acc.unexposedOrErrorRows += report.unexposedOrErrorRows;
      acc.errors += report.errors;
      acc.moreMissing += report.moreMissing;
      acc.over50 += report.over50;
      acc.maxRank = Math.max(acc.maxRank, report.maxRank);
      return acc;
    },
    {
      rows: 0,
      exposedRows: 0,
      unexposedOrErrorRows: 0,
      errors: 0,
      moreMissing: 0,
      over50: 0,
      maxRank: 0,
    }
  );

  const output = { sheetId: SPREADSHEET_ID, checkedAt, limit: LIMIT, aggregate, reports };
  const outputPath = path.join(
    process.cwd(),
    'output',
    `old-logic-more-excluding-dogmaru-readback-${checkedAt.replace(
      /[:.]/g,
      '-'
    )}.json`
  );
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
