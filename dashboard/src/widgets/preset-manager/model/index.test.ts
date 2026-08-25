import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeBlogIds,
} from './index';

test('붙여넣기로 들어온 계정은 뒤에 붙이고 중복은 버림', () => {
  assert.deepEqual(mergeBlogIds(['a', 'b'], ['b', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(mergeBlogIds(undefined, ['a']), ['a']);
});
