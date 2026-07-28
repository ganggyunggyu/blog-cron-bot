import assert from 'node:assert/strict';
import { toKeywordDocuments } from './index';

const checkedAt = new Date('2026-07-27T00:00:00.000Z');

const documents = toKeywordDocuments(
  [
    { keyword: '청주맛집', company: '아키아키', isUpdateRequired: true, isNewLogic: true },
    { keyword: '수원맛집', company: '샤브밀', isUpdateRequired: false, isNewLogic: false },
  ],
  'package',
  checkedAt,
  '패키지'
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
    isNewLogic: true,
    visibility: false,
    lastChecked: checkedAt,
  },
  {
    keyword: '수원맛집',
    company: '샤브밀',
    sheetType: 'package',
    keywordType: 'basic',
    isUpdateRequired: false,
    isNewLogic: false,
    visibility: false,
    lastChecked: checkedAt,
  },
]);

// sheetType은 호출부가 넘긴 값을 그대로 써야 대상별로 정확히 교체됨.
assert.equal(
  toKeywordDocuments(
    [{ keyword: 'a', company: 'b', isUpdateRequired: false, isNewLogic: false }],
    'dogmaru-exclude',
    checkedAt,
    '도그마루 제외'
  )[0].sheetType,
  'dogmaru-exclude'
);

// 도그마루처럼 원본 시트에 업체명 컬럼이 없는 경우, company가 비어있으면
// required 필드 검증에 걸려 insertMany 전체가 실패하므로 시트명으로 채워야 함.
assert.equal(
  toKeywordDocuments(
    [{ keyword: '가정견분양', company: '', isUpdateRequired: false, isNewLogic: false }],
    'dogmaru',
    checkedAt,
    '도그마루'
  )[0].company,
  '도그마루'
);

assert.deepEqual(toKeywordDocuments([], 'dogmaru', checkedAt, '도그마루'), []);

process.stdout.write('sheet keyword sync tests passed\n');
