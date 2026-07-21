import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { JWT } from 'google-auth-library';
import { sendDoorayExposureResult } from '../src/lib/dooray';
import {
  buildCafeScheduleExportRows,
  CafeScheduleCheckRow,
  CafeScheduleExportRow,
} from '../src/lib/cafe-schedule-export';
import { assertWritableSheetId } from '../src/lib/google-sheets/write-target-guard';

dotenv.config();

const SOURCE_SHEET_ID = '1vrN5gvtokWxPs8CNaNcvZQLWyIMBOIcteYXQbyfiZl0';
const SOURCE_GID = 126285763;
const SOURCE_TITLE = '카페 발행스케줄';
const TARGET_SHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const TARGET_GID = 1406050962;
const TARGET_TITLE = '카페노출체크';

const HEADERS = ['키워드', '노출여부', '순위', '카페블로그명', '링크'];

interface CheckArtifact {
  summary: {
    checkedAt: string;
    retryFailedOnly?: boolean;
  };
  rows: CafeScheduleCheckRow[];
}

interface TargetSpreadsheetMetadata {
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
      gridProperties?: {
        rowCount?: number;
        columnCount?: number;
      };
    };
  }>;
}

const text = (value: unknown): string => String(value ?? '').trim();

const getAuth = (readOnly: boolean): JWT => {
  const email = text(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const key = text(process.env.GOOGLE_PRIVATE_KEY)
    .replace(/\\\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\+$/, '');

  if (!email || !key) {
    throw new Error('Google Sheets 서비스 계정 환경변수가 없음');
  }

  return new JWT({
    email,
    key,
    scopes: [
      readOnly
        ? 'https://www.googleapis.com/auth/spreadsheets.readonly'
        : 'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
};

const loadSourceValues = async (): Promise<unknown[][]> => {
  const auth = getAuth(true);
  const metadata = await auth.request<TargetSpreadsheetMetadata>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_SHEET_ID}?fields=sheets.properties`,
    method: 'GET',
  });
  const source = metadata.data.sheets
    ?.map((sheet) => sheet.properties)
    .find((sheet) => sheet?.sheetId === SOURCE_GID);
  if (!source || source.title !== SOURCE_TITLE) {
    throw new Error(`원본 gid=${SOURCE_GID} 탭을 찾지 못했거나 탭명이 다름`);
  }

  const range = encodeURIComponent(`${SOURCE_TITLE}!A:A`);
  const response = await auth.request<{ values?: unknown[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_SHEET_ID}/values/${range}`,
    method: 'GET',
  });
  return response.data.values ?? [];
};

const loadLatestCheckArtifact = (): {
  artifactPath: string;
  artifact: CheckArtifact;
} => {
  const outputDir = path.join(process.cwd(), 'outputs');
  const latest = fs
    .readdirSync(outputDir)
    .filter((file) => file.startsWith('cafe-schedule-exposure-'))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .at(-1);

  if (!latest) {
    throw new Error('내보낼 카페 노출체크 artifact가 없음');
  }

  const artifactPath = path.join(outputDir, latest);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as CheckArtifact;
  if (!Array.isArray(artifact.rows)) {
    throw new Error(`카페 노출체크 artifact 형식이 올바르지 않음: ${artifactPath}`);
  }

  return { artifactPath, artifact };
};

const loadSourceRows = async (
  artifact: CheckArtifact
): Promise<CafeScheduleExportRow[]> => {
  const values = await loadSourceValues();
  const markerRowIndex = values.findIndex((row) =>
    /스케[줄쥴]/.test(text(row?.[0]))
  );
  if (markerRowIndex < 0) throw new Error('A열 스케줄 제목을 찾지 못함');

  let lastScheduleRowIndex = markerRowIndex;
  for (let rowIndex = markerRowIndex + 1; rowIndex < values.length; rowIndex += 1) {
    const keyword = String(values[rowIndex]?.[0] ?? '');
    if (/스케[줄쥴]/.test(keyword.trim())) break;
    if (keyword) lastScheduleRowIndex = rowIndex;
  }

  const sourceRows: Array<{ row: number; keyword: string }> = [];
  for (
    let rowIndex = markerRowIndex + 1;
    rowIndex <= lastScheduleRowIndex;
    rowIndex += 1
  ) {
    sourceRows.push({
      row: rowIndex + 1,
      keyword: String(values[rowIndex]?.[0] ?? ''),
    });
  }

  return buildCafeScheduleExportRows(sourceRows, artifact.rows, true);
};

const exportRows = async (rows: CafeScheduleExportRow[]): Promise<void> => {
  assertWritableSheetId(TARGET_SHEET_ID, '카페 노출체크 내보내기');
  const auth = getAuth(false);
  const metadataResponse = await auth.request<TargetSpreadsheetMetadata>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SHEET_ID}?fields=sheets.properties`,
    method: 'GET',
  });
  const properties = metadataResponse.data.sheets
    ?.map((sheet) => sheet.properties)
    .find((sheet) => sheet?.sheetId === TARGET_GID);

  if (!properties) throw new Error(`gid=${TARGET_GID} 시트를 찾지 못함`);
  if (properties.title !== TARGET_TITLE) {
    throw new Error(
      `예상 탭명 ${TARGET_TITLE}과 실제 탭명 ${properties.title ?? '(없음)'}이 다름`
    );
  }

  const values = [
    HEADERS,
    ...rows.map((row) => HEADERS.map((header) => row[header] ?? '')),
  ];
  const requiredRowCount = Math.max(values.length + 20, 1000);
  const currentRowCount = properties.gridProperties?.rowCount ?? 0;
  const currentColumnCount = properties.gridProperties?.columnCount ?? 0;
  const targetRowCount = Math.max(currentRowCount, requiredRowCount);
  const targetColumnCount = Math.max(currentColumnCount, HEADERS.length);
  const requests: Array<Record<string, unknown>> = [];

  if (
    currentRowCount < requiredRowCount ||
    currentColumnCount < HEADERS.length
  ) {
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: TARGET_GID,
          gridProperties: {
            rowCount: targetRowCount,
            columnCount: targetColumnCount,
          },
        },
        fields: 'gridProperties(rowCount,columnCount)',
      },
    });
  }

  requests.push(
    {
      repeatCell: {
        range: {
          sheetId: TARGET_GID,
          startColumnIndex: 0,
          endColumnIndex: HEADERS.length,
        },
        cell: {},
        fields: 'userEnteredValue',
      },
    },
    {
      updateCells: {
        start: { sheetId: TARGET_GID, rowIndex: 0, columnIndex: 0 },
        rows: values.map((row) => ({
          values: row.map((value) => ({
            userEnteredValue: { stringValue: value },
          })),
        })),
        fields: 'userEnteredValue',
      },
    }
  );

  // clear와 write를 한 batchUpdate에 넣어 중간 실패 시 빈 결과 탭이 남지 않게 한다.
  await auth.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SHEET_ID}:batchUpdate`,
    method: 'POST',
    data: { requests },
  });

  const readbackRange = encodeURIComponent(
    `${TARGET_TITLE}!A1:E${values.length}`
  );
  const readback = await getAuth(true).request<{ values?: unknown[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SHEET_ID}/values/${readbackRange}`,
    method: 'GET',
  });
  const actual = readback.data.values ?? [];
  values.forEach((expectedRow, rowIndex) => {
    expectedRow.forEach((expectedValue, columnIndex) => {
      const actualValue = String(actual[rowIndex]?.[columnIndex] ?? '');
      if (actualValue !== expectedValue) {
        throw new Error(
          `${TARGET_TITLE} 재조회 불일치: ${rowIndex + 1}행 ${columnIndex + 1}열 ` +
            `(기대=${expectedValue}, 실제=${actualValue})`
        );
      }
    });
  });
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const { artifactPath, artifact } = loadLatestCheckArtifact();
  const rows = await loadSourceRows(artifact);
  if (rows.length === 0) throw new Error('내보낼 스케줄 키워드가 없음');

  await exportRows(rows);

  const summary = {
    sourceSheetId: SOURCE_SHEET_ID,
    sourceGid: SOURCE_GID,
    sourceTab: SOURCE_TITLE,
    targetSheetId: TARGET_SHEET_ID,
    targetGid: TARGET_GID,
    targetTitle: TARGET_TITLE,
    rows: rows.length,
    exposed: rows.filter((row) => row.노출여부 === 'o').length,
    failed: artifact.rows.filter(
      (row) => row.exposureStatus === '확인실패'
    ).length,
    artifactPath,
    dooraySent: false,
  };
  const outputPath = path.join(
    process.cwd(),
    'outputs',
    `cafe-schedule-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const dooraySent = await sendDoorayExposureResult({
    cronType: '카페 블로그 통합 노출체크',
    totalKeywords: rows.filter((row) => row.키워드).length,
    exposureCount: summary.exposed,
    popularCount: 0,
    sblCount: 0,
    elapsedTime: `${Math.max(1, Math.round((Date.now() - startedAt) / 1000))}초`,
    missingKeywords: rows
      .filter((row) => row.키워드 && row.노출여부 !== 'o')
      .map((row) => row.키워드),
  });
  if (!dooraySent) {
    throw new Error('카페 통합 노출체크 Dooray 전송 실패');
  }
  summary.dooraySent = true;
  fs.writeFileSync(outputPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ summary, outputPath }, null, 2)}\n`);

  if (summary.failed > 0) {
    throw new Error(`카페 노출체크 확인실패 ${summary.failed}건이 남아 있음`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
