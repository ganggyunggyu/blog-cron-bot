import assert from 'node:assert/strict';
import {
  BLOG_ID_SEEDS,
  DOGMARU_BLOG_IDS,
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE,
  PET_PAGE_CHECK_BLOG_IDS,
  SURI_PET_BLOG_IDS,
  SURI_PET_PAGE_CHECK_BLOG_IDS,
  applyBlogIdOverrides,
  resolveManagedBlogIds,
} from './index';

// 시드는 코드 상수와 정확히 같아야 한다. 어긋나면 대시보드가 실제와 다른 목록을 보여준다.
assert.deepEqual(BLOG_ID_SEEDS.dogmaru, [...DOGMARU_BLOG_IDS]);
assert.deepEqual(BLOG_ID_SEEDS.suripet, [...SURI_PET_BLOG_IDS]);

const petBaseline = [...PET_PAGE_CHECK_BLOG_IDS];

// 덮어쓰기가 없으면 결과가 오늘과 완전히 같아야 한다(저장소가 비었을 때의 안전망).
applyBlogIdOverrides({});
assert.deepEqual([...DOGMARU_BLOG_IDS], BLOG_ID_SEEDS.dogmaru);
assert.deepEqual([...SURI_PET_BLOG_IDS], BLOG_ID_SEEDS.suripet);
assert.deepEqual([...PET_PAGE_CHECK_BLOG_IDS], petBaseline);

// 추가는 최종 목록과 파생 목록(애견)에 모두 반영돼야 한다.
applyBlogIdOverrides({ suripet: { added: ['newsuripet'], removed: [] } });
assert.ok(SURI_PET_BLOG_IDS.includes('newsuripet'));
assert.ok(SURI_PET_PAGE_CHECK_BLOG_IDS.includes('newsuripet'));
assert.ok(PET_PAGE_CHECK_BLOG_IDS.includes('newsuripet'));
assert.ok(PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE.suripet.includes('newsuripet'));

// 제외는 추가보다 우선한다.
applyBlogIdOverrides({
  suripet: { added: ['ylk3516'], removed: ['ylk3516'] },
});
assert.ok(!SURI_PET_BLOG_IDS.includes('ylk3516'));

// 도그마루도 같은 규칙으로 동작한다.
applyBlogIdOverrides({ dogmaru: { added: ['newdogmaru'], removed: ['tpeany'] } });
assert.ok(DOGMARU_BLOG_IDS.includes('newdogmaru'));
assert.ok(DOGMARU_PAGE_CHECK_BLOG_IDS.includes('newdogmaru'));
assert.ok(!DOGMARU_BLOG_IDS.includes('tpeany'));

// 순수 함수는 대문자로 들어와도 소문자로 정규화한다.
assert.deepEqual(
  resolveManagedBlogIds('suripet', { added: ['UPPERCASE'], removed: [] }).filter(
    (id) => id === 'uppercase'
  ),
  ['uppercase']
);

// 마지막에 기본값으로 되돌려 다른 테스트에 영향을 주지 않는다.
applyBlogIdOverrides({});
assert.deepEqual([...PET_PAGE_CHECK_BLOG_IDS], petBaseline);

process.stdout.write('blog id override tests passed\n');
