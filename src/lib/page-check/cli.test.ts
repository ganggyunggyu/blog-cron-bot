import assert from 'node:assert/strict';
import {
  getPageCheckUsage,
  selectPageCheckTargets,
} from './cli';

assert.deepEqual(selectPageCheckTargets([]), {});
assert.deepEqual(selectPageCheckTargets(['pet']), {
  targetSheetTypes: ['pet'],
  notice: '🎯 대상 시트: 애견',
});
assert.deepEqual(selectPageCheckTargets(['pet,pet,suripet']), {
  targetSheetTypes: ['pet', 'suripet'],
  notice: '🎯 대상 시트: 애견, 서리펫',
});
assert.deepEqual(selectPageCheckTargets(['--exclude', 'pet']), {
  targetSheetTypes: ['suripet'],
  notice: '🚫 제외 모드: 애견 제외',
});
assert.deepEqual(selectPageCheckTargets(['dogmaru,pet,suripet']), {
  targetSheetTypes: ['dogmaru', 'pet', 'suripet'],
  notice: '🎯 대상 시트: 도그마루, 애견, 서리펫',
});
assert.deepEqual(selectPageCheckTargets(['dogmaru']), {
  error: '❌ 유효하지 않은 sheetType 조합: dogmaru',
});
assert.deepEqual(selectPageCheckTargets(['unknown']), {
  error: '❌ 유효하지 않은 sheetType 조합: unknown',
});
assert.equal(getPageCheckUsage(), '사용 가능: pet, suripet 또는 dogmaru,pet,suripet');

process.stdout.write('page check cli tests passed\n');
