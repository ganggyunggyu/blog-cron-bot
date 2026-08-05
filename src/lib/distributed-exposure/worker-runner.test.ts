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

process.stdout.write('worker-runner tests passed\n');
