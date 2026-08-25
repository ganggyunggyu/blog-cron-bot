import assert from 'node:assert/strict';
import { getUncheckedDistributedKeywordIds } from './worker-runner';
import type { IDistributedExposureJob } from './models';

// DB에 연결하지 않고 반환값의 종류(undefined vs Promise)만 본다. 실제 값은 Mongo
// ObjectId 형식이어야 쿼리 빌더 단계에서 캐스팅 에러 없이 (연결 실패로) 거부된다.
const buildJob = (
  overrides: Partial<IDistributedExposureJob>
): IDistributedExposureJob =>
  ({
    target: 'root',
    jobKind: 'standard',
    keywordIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    startedAt: new Date(),
    ...overrides,
  }) as IDistributedExposureJob;

/** DB 연결이 없어 거부되는 건 이 테스트의 관심사가 아니므로 조용히 무시한다. */
const ignoreRejection = (value: Promise<string[]> | undefined) => {
  value?.catch(() => undefined);
  return value;
};

/**
 * 더보기(old-logic-more)는 결과를 구글시트 워커 탭에만 쓰고 RootKeyword.lastChecked나
 * 페이지 체크 컬렉션의 updatedAt은 건드리지 않는다. 그 값을 검사하는 갱신 확인을 더보기에
 * 적용하면 크롤이 끝나도 항상 "누락"으로 잡혀 재시도 한도까지 같은 조각을 반복한다 —
 * 루트 더보기가 90분 내내 0/10에서 멈춰 있던 원인이 이것이었다.
 */
assert.equal(
  getUncheckedDistributedKeywordIds(
    buildJob({ target: 'root', jobKind: 'old-logic-more' })
  ),
  undefined,
  '더보기 잡은 DB 갱신을 절대 확인하면 안 됨'
);

assert.equal(
  getUncheckedDistributedKeywordIds(
    buildJob({ target: 'pet', jobKind: 'old-logic-more' })
  ),
  undefined,
  '애견 더보기 잡도 마찬가지'
);

// 기본 노출체크는 계속 DB를 직접 갱신하므로 이 확인이 필요하다 (undefined가 아님).
assert.notEqual(
  ignoreRejection(
    getUncheckedDistributedKeywordIds(
      buildJob({ target: 'root', jobKind: 'standard' })
    )
  ),
  undefined,
  '기본 루트 노출체크는 여전히 갱신 확인을 거쳐야 함'
);

assert.notEqual(
  ignoreRejection(
    getUncheckedDistributedKeywordIds(
      buildJob({ target: 'suripet', jobKind: 'standard' })
    )
  ),
  undefined,
  '기본 서리펫 노출체크도 여전히 갱신 확인을 거쳐야 함'
);

// startedAt이 없거나 키워드가 없으면 어차피 확인할 대상이 없다.
assert.equal(
  getUncheckedDistributedKeywordIds(
    buildJob({ target: 'root', jobKind: 'standard', startedAt: undefined })
  ),
  undefined
);
assert.equal(
  getUncheckedDistributedKeywordIds(
    buildJob({ target: 'root', jobKind: 'standard', keywordIds: [] })
  ),
  undefined
);

// 카페 URL 잡도 RootKeyword를 갱신하지 않는다. 결과는 전용 컬렉션에만 쌓이므로
// 여기서 확인하면 조각마다 "누락" 판정이 나서 재시도 한도까지 돈다.
assert.equal(
  getUncheckedDistributedKeywordIds(
    buildJob({ target: 'root-cafe-url', jobKind: 'root-cafe-url' })
  ),
  undefined,
  '카페 URL 잡은 DB 갱신을 확인하면 안 됨'
);

// standard가 아닌 종류는 앞으로 무엇이 추가되든 전부 빠져야 한다. 이 줄이 통과하는
// 한, 새 kind를 만들 때 worker-runner를 같이 고치는 걸 잊어도 사고가 안 난다.
assert.equal(
  getUncheckedDistributedKeywordIds(
    buildJob({ target: 'root', jobKind: 'made-up-future-kind' as never })
  ),
  undefined,
  'standard가 아닌 종류는 전부 갱신 확인에서 빠져야 함'
);

process.stdout.write('worker-runner tests passed\n');
