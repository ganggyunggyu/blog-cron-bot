import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildSheetRows,
  saveToCSV,
  saveToSheetCSV,
} from '../../csv-writer';
import type { ExposureResult } from '../../matcher';
import { escapeCsvValue } from './format';
import { parseCsv } from './parse';
import { resolveOutputFilePath } from './output-path';

const removeFileIfExists = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const readCsvWithoutBom = (filePath: string): string[] => {
  const raw = fs.readFileSync(filePath, 'utf8');
  assert.equal(raw.charCodeAt(0), 0xfeff);
  return raw.slice(1).split('\n');
};

assert.equal(escapeCsvValue('a "quoted" value'), '"a ""quoted"" value"');
assert.deepEqual(parseCsv('\uFEFF"업체,명","키""워드"\r\nA,B'), [
  ['업체,명', '키"워드'],
  ['A', 'B'],
]);

const exposureFilename = 'test-unit-exposure_2026-07-01-10-00-00.csv';
const exposureFilePath = resolveOutputFilePath(exposureFilename);
const expectedExposurePath = path.join(
  process.cwd(),
  'output',
  '2026-07월1주차',
  'test',
  exposureFilename
);
assert.equal(exposureFilePath, expectedExposurePath);

const exposureResult: ExposureResult = {
  query: '강아지 "분양"',
  blogId: 'blog1',
  blogName: '블로그 "이름"',
  postTitle: '제목 "인용"',
  postLink: 'https://blog.naver.com/blog1/1',
  postPublishedAt: '2026.07.01.',
  exposureType: '인기글',
  topicName: '주제 "A"',
  position: 3,
  isNewLogic: true,
};

removeFileIfExists(exposureFilePath);
saveToCSV([exposureResult], exposureFilename);

const exposureLines = readCsvWithoutBom(exposureFilePath);
assert.equal(
  exposureLines[0],
  '검색어,블로그ID,블로그명,게시글제목,게시글링크,발행일,인기주제,스블주제명,순위,로직'
);
assert.equal(
  exposureLines[1],
  '"강아지 ""분양""",blog1,"블로그 ""이름""","제목 ""인용""",https://blog.naver.com/blog1/1,"2026.07.01.",인기글,"주제 ""A""",3,신규'
);
removeFileIfExists(exposureFilePath);

const sheetFilename = 'test-unit-sheet_2026-07-01-10-00-00.csv';
const sheetFilePath = resolveOutputFilePath(sheetFilename);
const duplicateResults: ExposureResult[] = [
  {
    ...exposureResult,
    query: '중복',
    postTitle: '첫 번째',
    postLink: 'https://blog.naver.com/blog1/first',
    position: 1,
  },
  {
    ...exposureResult,
    query: '중복',
    postTitle: '두 번째',
    postLink: 'https://blog.naver.com/blog2/second',
    exposureType: '스블',
    topicName: '스블주제',
    position: 2,
    isNewLogic: false,
    postPublishedAt: '2026.07.02.',
  },
];

removeFileIfExists(sheetFilePath);
saveToSheetCSV(
  [
    { keyword: '중복', company: '업체A' },
    { keyword: '중복', company: '업체B' },
    { keyword: '미노출', company: '업체C' },
  ],
  duplicateResults,
  sheetFilename,
  new Map([['미노출', false]])
);

const sheetLines = readCsvWithoutBom(sheetFilePath);
assert.equal(sheetLines.length, 4);
assert.match(sheetLines[1], /^"업체A","중복","주제 ""A""",1,o,,1,,https:\/\/blog\.naver\.com\/blog1\/first/);
assert.match(sheetLines[2], /^"업체B","중복","스블주제",2,o,,,,https:\/\/blog\.naver\.com\/blog2\/second/);
assert.match(sheetLines[3], /^"업체C","미노출",+구,3$/);
removeFileIfExists(sheetFilePath);

const crossCompanyFilename = 'test-unit-cross-company.csv';
const crossCompanyFilePath = resolveOutputFilePath(crossCompanyFilename);
removeFileIfExists(crossCompanyFilePath);
saveToSheetCSV(
  [
    { keyword: '공유키워드', company: '애견' },
    { keyword: '공유키워드', company: '서리펫' },
  ],
  [
    {
      ...exposureResult,
      query: '공유키워드',
      company: '서리펫',
      postLink: 'https://blog.naver.com/suripet/result',
    },
  ],
  crossCompanyFilename
);
const crossCompanyLines = readCsvWithoutBom(crossCompanyFilePath);
assert.match(crossCompanyLines[1], /^"애견","공유키워드",+1$/);
assert.match(
  crossCompanyLines[2],
  /^"서리펫","공유키워드".*https:\/\/blog\.naver\.com\/suripet\/result/
);
removeFileIfExists(crossCompanyFilePath);

const orderedRows = buildSheetRows(
  [
    { keyword: '중복', company: '첫업체' },
    { keyword: '사이', company: '다른업체' },
    { keyword: '중복', company: '둘째업체' },
  ],
  [
    {
      ...exposureResult,
      query: '중복',
      company: '둘째업체',
      postLink: 'https://blog.naver.com/second/2',
    },
    {
      ...exposureResult,
      query: '중복',
      company: '첫업체',
      postLink: 'https://blog.naver.com/first/1',
    },
  ]
);

assert.deepEqual(
  orderedRows.map((row) => [row[0], row[1], row[8], row[11]]),
  [
    ['첫업체', '중복', 'https://blog.naver.com/first/1', 1],
    ['다른업체', '사이', '', 2],
    ['둘째업체', '중복', 'https://blog.naver.com/second/2', 3],
  ]
);

process.stdout.write('csv output tests passed\n');
