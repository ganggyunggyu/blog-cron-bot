import assert from 'node:assert/strict';
import { findHeaderRowIndex } from './direct-exposure-sheet';

// 헤더가 1행에 바로 있는 일반적인 경우 (패키지/도그마루 제외/도그마루 탭)
assert.equal(
  findHeaderRowIndex([['업체', '키워드', '노출여부']], '키워드'),
  0
);

// 실제 "월보장 시트"(루트) 탭처럼 헤더 앞에 빈 행이 2개 있는 경우
assert.equal(
  findHeaderRowIndex(
    [
      ['', '', ''],
      ['', '', ''],
      ['업체명', '키워드', '인기주제'],
      ['아키아키', '청주맛집', ''],
    ],
    '키워드'
  ),
  2
);

// 대상 헤더가 스캔 범위 안에 아예 없으면 null
assert.equal(
  findHeaderRowIndex([['제목', '링크'], ['', '']], '키워드'),
  null
);

// 빈 그리드
assert.equal(findHeaderRowIndex([], '키워드'), null);

// "키워드"가 여러 행에 걸쳐 나오면 가장 먼저 나오는 행을 채택
assert.equal(
  findHeaderRowIndex(
    [
      ['설명'],
      ['키워드', '순위'],
      ['키워드', '비고'],
    ],
    '키워드'
  ),
  1
);

process.stdout.write('direct-exposure-sheet tests passed\n');
