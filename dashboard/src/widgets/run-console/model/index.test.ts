import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTargetRows, formatElapsed, summarizeShards } from './index';

test('완료 신호가 total 없이 와도 진행률을 100으로 채움', () => {
  const [row] = buildTargetRows([
    { target: 'root', current: 0, total: 0, status: 'success' },
  ]);
  assert.equal(row.percent, 100);
  assert.equal(row.label, '루트');
});

test('진행 중인 대상은 실제 비율로 계산함', () => {
  const [row] = buildTargetRows([
    { target: 'pet', current: 15, total: 30, status: 'running' },
  ]);
  assert.equal(row.percent, 50);
});

test('알 수 없는 대상 이름은 그대로 씀', () => {
  const [row] = buildTargetRows([
    { target: 'unknown-sheet', current: 1, total: 2, status: 'running' },
  ]);
  assert.equal(row.label, 'unknown-sheet');
});

test('전체 조각은 완료 시트를 총량으로 세어 합침', () => {
  const rows = buildTargetRows([
    { target: 'package', current: 12, total: 30, status: 'success' },
    { target: 'general', current: 15, total: 30, status: 'running' },
  ]);
  assert.deepEqual(summarizeShards(rows), { done: 45, total: 60, percent: 75 });
});

test('조각 정보가 아직 없으면 0으로 둠', () => {
  assert.deepEqual(summarizeShards([]), { done: 0, total: 0, percent: 0 });
});

test('경과 시간은 분과 초로 읽히게 만듦', () => {
  assert.equal(formatElapsed(0), '0초');
  assert.equal(formatElapsed(45_000), '45초');
  assert.equal(formatElapsed(743_000), '12분 23초');
  assert.equal(formatElapsed(3_900_000), '1시간 5분');
});

test('음수 경과는 0초로 막음', () => {
  assert.equal(formatElapsed(-5_000), '0초');
});
