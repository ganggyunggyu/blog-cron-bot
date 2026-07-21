import assert from 'node:assert/strict';
import { formatDoorayExposureMessage } from './dooray';
import { resolveDooraySheetLinks } from './dooray-sheet-links';

const fixedDate = new Date('2026-07-20T10:04:00.000Z');

assert.equal(
  formatDoorayExposureMessage(
    {
      cronType: '카페 블로그 통합 노출체크',
      totalKeywords: 135,
      exposureCount: 7,
    },
    fixedDate
  ),
  '[카페 블로그 통합 노출체크] 2026. 07. 20. 오후 07:04\n' +
    '노출 7개 / 미노출 128개'
);

assert.equal(
  formatDoorayExposureMessage(
    {
      cronType: '멀티페이지 크론 [애견 노출체크]',
      totalKeywords: 50,
      exposureCount: 12,
    },
    fixedDate
  ),
  '[애견 노출체크] 2026. 07. 20. 오후 07:04\n' +
    '노출 12개 / 미노출 38개'
);

assert.equal(
  formatDoorayExposureMessage(
    {
      cronType: '카페 블로그 통합 노출체크',
      totalKeywords: 135,
      exposureCount: 24,
      sheetLinks: [
        {
          name: '카페노출체크',
          url: 'https://docs.google.com/spreadsheets/d/test/edit#gid=1406050962',
        },
      ],
    },
    fixedDate
  ),
  '[카페 블로그 통합 노출체크] 2026. 07. 20. 오후 07:04\n' +
    '노출 24개 / 미노출 111개\n' +
    '시트: https://docs.google.com/spreadsheets/d/test/edit#gid=1406050962'
);

assert.deepEqual(
  resolveDooraySheetLinks(['멀티페이지 크론 [도그마루, 애견, 서리펫]']),
  [
    {
      name: '도그마루',
      url: 'https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit#gid=1243473706',
    },
    {
      name: '애견(전체블로그)',
      url: 'https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit#gid=529625636',
    },
    {
      name: '서리펫',
      url: 'https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit#gid=934688657',
    },
  ]
);

console.log('dooray message tests passed');
