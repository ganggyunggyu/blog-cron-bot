import assert from 'node:assert/strict';
import test from 'node:test';
import type { PresetTarget } from '@/entities/preset';
import {
  duplicateTargetAt,
  matchesTargetQuery,
  mergeBlogIds,
  moveTarget,
} from './index';

const makeTarget = (id: string, label = id): PresetTarget => ({
  id,
  label,
  kind: 'basic',
  source: { sheetId: 'sheet-a', tabTitle: `${id}탭` },
  enabled: true,
});

test('대상을 복제하면 id가 겹치지 않고 바로 뒤에 들어감', () => {
  const targets = [makeTarget('package'), makeTarget('root')];
  const next = duplicateTargetAt(targets, 0);

  assert.deepEqual(
    next.map(({ id }) => id),
    ['package', 'package-copy', 'root'],
  );
  assert.equal(next[1]?.label, 'package 복사본');
});

test('복제본 id가 이미 있으면 번호를 올려서 딴다', () => {
  const targets = [makeTarget('package'), makeTarget('package-copy')];
  const next = duplicateTargetAt(targets, 0);

  assert.deepEqual(
    next.map(({ id }) => id),
    ['package', 'package-copy2', 'package-copy'],
  );
});

test('복제본의 시트를 고쳐도 원본은 그대로임', () => {
  const targets = [makeTarget('package')];
  const next = duplicateTargetAt(targets, 0);
  next[1].source.tabTitle = '바뀐탭';

  assert.equal(next[0]?.source.tabTitle, 'package탭');
});

test('대상 순서를 위아래로 옮김', () => {
  const targets = [makeTarget('a'), makeTarget('b'), makeTarget('c')];

  assert.deepEqual(
    moveTarget(targets, 2, -1).map(({ id }) => id),
    ['a', 'c', 'b'],
  );
  assert.deepEqual(
    moveTarget(targets, 0, 1).map(({ id }) => id),
    ['b', 'a', 'c'],
  );
});

test('목록 밖으로 나가는 이동은 무시함', () => {
  const targets = [makeTarget('a'), makeTarget('b')];

  assert.deepEqual(moveTarget(targets, 0, -1), targets);
  assert.deepEqual(moveTarget(targets, 1, 1), targets);
});

test('대상 검색은 이름과 시트 탭을 같이 봄', () => {
  const target = makeTarget('package', '패키지');

  assert.equal(matchesTargetQuery(target, '패키'), true);
  assert.equal(matchesTargetQuery(target, 'PACKAGE'), true);
  assert.equal(matchesTargetQuery(target, 'package탭'), true);
  assert.equal(matchesTargetQuery(target, ''), true);
  assert.equal(matchesTargetQuery(target, '도그마루'), false);
});

test('붙여넣기로 들어온 계정은 뒤에 붙이고 중복은 버림', () => {
  assert.deepEqual(mergeBlogIds(['a', 'b'], ['b', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(mergeBlogIds(undefined, ['a']), ['a']);
});
