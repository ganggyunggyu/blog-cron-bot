import assert from 'node:assert/strict';
import { dedupeRootExposedByLink } from './root-finalizer';

// 같은 키워드+업체명에 같은 링크가 반복되면 하나만 남김.
const deduped = dedupeRootExposedByLink([
  { keyword: '청주 봉명동 맛집(가게A)', company: '가게A', url: 'https://blog.naver.com/x/1' },
  { keyword: '청주 봉명동 맛집(가게A)', company: '가게A', url: 'https://blog.naver.com/x/1' },
  { keyword: '강남 룸식당(육목원)', company: '육목원', url: 'https://blog.naver.com/x/2' },
  { keyword: '강남 룸식당(파크루안)', company: '파크루안', url: 'https://blog.naver.com/x/2' },
]);

// 첫 키워드 중복 1건 제거, 서로 다른 키워드가 같은 링크 공유하는 2건은 유지 → 총 3건
assert.equal(deduped.length, 3);
assert.deepEqual(
  deduped.map(({ keyword }) => keyword),
  ['청주 봉명동 맛집(가게A)', '강남 룸식당(육목원)', '강남 룸식당(파크루안)']
);

// 링크가 없는 항목은 dedup 대상에서 제외(그대로 유지).
const blanks = dedupeRootExposedByLink([
  { keyword: 'a(회사)', company: '회사', url: '' },
  { keyword: 'a(회사)', company: '회사', url: '' },
]);
assert.equal(blanks.length, 2);

process.stdout.write('root finalizer dedup tests passed\n');
