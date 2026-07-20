import assert from 'node:assert/strict';
import { formatDoorayExposureMessage } from './dooray';

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

console.log('dooray message tests passed');
