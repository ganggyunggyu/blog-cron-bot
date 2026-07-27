import assert from 'node:assert/strict';
import { toKeywordDocuments } from './index';

const checkedAt = new Date('2026-07-27T00:00:00.000Z');

const documents = toKeywordDocuments(
  [
    { keyword: '청주맛집', company: '아키아키', isUpdateRequired: true },
    { keyword: '수원맛집', company: '샤브밀', isUpdateRequired: false },
  ],
  'package',
  checkedAt
);

// 원본 시트의 키워드/업체명/바이럴 체크만 가져오고, 노출 결과 필드는 이번 실행에서
// 새로 채우도록 비운 상태여야 함.
assert.deepEqual(documents, [
  {
    keyword: '청주맛집',
    company: '아키아키',
    sheetType: 'package',
    keywordType: 'basic',
    isUpdateRequired: true,
    visibility: false,
    lastChecked: checkedAt,
  },
  {
    keyword: '수원맛집',
    company: '샤브밀',
    sheetType: 'package',
    keywordType: 'basic',
    isUpdateRequired: false,
    visibility: false,
    lastChecked: checkedAt,
  },
]);

// sheetType은 호출부가 넘긴 값을 그대로 써야 대상별로 정확히 교체됨.
assert.equal(
  toKeywordDocuments(
    [{ keyword: 'a', company: 'b', isUpdateRequired: false }],
    'dogmaru-exclude',
    checkedAt
  )[0].sheetType,
  'dogmaru-exclude'
);

assert.deepEqual(toKeywordDocuments([], 'dogmaru', checkedAt), []);

process.stdout.write('sheet keyword sync tests passed\n');
