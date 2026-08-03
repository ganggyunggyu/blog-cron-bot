import assert from 'node:assert/strict';
import {
  DEFAULT_MORE_TARGETS,
  MORE_TARGET_LABELS,
  parseMoreTargets,
} from './more-targets';

// 인자가 없으면 예전 동작(세 시트 묶음)을 그대로 유지한다.
assert.deepEqual(parseMoreTargets([]), [...DEFAULT_MORE_TARGETS]);
assert.deepEqual(parseMoreTargets(['--targets=']), [...DEFAULT_MORE_TARGETS]);
assert.deepEqual(parseMoreTargets(['--targets= , ']), [...DEFAULT_MORE_TARGETS]);

// 루트만 따로 돌릴 수 있어야 한다.
assert.deepEqual(parseMoreTargets(['--targets=root']), ['root']);
assert.deepEqual(parseMoreTargets(['--targets=root,dogmaru']), [
  'root',
  'dogmaru',
]);
assert.deepEqual(parseMoreTargets(['--targets= root , dogmaru ']), [
  'root',
  'dogmaru',
]);

// 같은 대상을 두 번 적어도 조각을 두 벌 만들지 않는다.
assert.deepEqual(parseMoreTargets(['--targets=root,root']), ['root']);

// 오타를 무시하면 아무것도 안 돌고 성공으로 끝나므로 막는다.
assert.throws(
  () => parseMoreTargets(['--targets=roots']),
  /더보기 대상이 아님: roots/
);
assert.throws(
  () => parseMoreTargets(['--targets=root,pet']),
  /더보기 대상이 아님: pet/
);

// 다른 인자 사이에 섞여 있어도 찾는다.
assert.deepEqual(
  parseMoreTargets(['--', '--targets=root', '--something-else']),
  ['root']
);

assert.equal(MORE_TARGET_LABELS.root, '루트');

process.stdout.write('distributed more target tests passed\n');
