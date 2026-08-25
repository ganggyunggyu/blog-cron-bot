import assert from 'node:assert/strict';
import test from 'node:test';
import type { JobDefinition } from '@/entities/job';
import { buildCheckRows } from './rows';

const job = (over: Partial<JobDefinition>): JobDefinition =>
  ({
    id: 'x',
    label: 'X',
    description: '',
    kind: 'standard',
    isRunning: false,
    isBlocked: false,
    ...over,
  }) as JobDefinition;

const labels = new Map([
  ['pet', '애견'],
  ['package', '패키지'],
]);

test('대상이 같은 잡 둘은 한 줄로 합쳐짐', () => {
  const rows = buildCheckRows(
    [
      job({ id: 'pet-exposure', label: '애견 1페이지', section: 'daily', targetId: 'pet' }),
      job({ id: 'pet-9', label: '애견 1~9페이지', section: 'daily', targetId: 'pet' }),
      job({ id: 'package-exposure', label: '패키지', section: 'daily', targetId: 'package' }),
    ],
    'daily',
    labels,
  );
  assert.equal(rows.length, 2);
  const [pet] = rows;
  assert.equal(pet.label, '애견');
  assert.equal(pet.jobs.length, 2, '두 잡이 한 줄에 모여야 선택기가 뜸');
  assert.equal(pet.targetId, 'pet');
});

test('줄 이름은 잡 이름이 아니라 대상 이름을 씀', () => {
  // 잡 이름은 "애견 1페이지"라 그대로 쓰면 줄마다 페이지 수가 붙어버린다.
  const [row] = buildCheckRows(
    [job({ id: 'pet-exposure', label: '애견 1페이지', section: 'daily', targetId: 'pet' })],
    'daily',
    labels,
  );
  assert.equal(row.label, '애견');
});

test('대상이 없는 잡은 각자 한 줄이고 고를 수 없음', () => {
  const rows = buildCheckRows(
    [
      job({ id: 'reexport', label: '결과 다시 내보내기', section: 'tool' }),
      job({ id: 'cafe-url', label: '카페 글 노출 확인', section: 'tool' }),
    ],
    'tool',
    labels,
  );
  assert.equal(rows.length, 2);
  rows.forEach((row) => assert.equal(row.targetId, undefined));
});

test('다른 구역의 잡은 섞이지 않음', () => {
  const jobs = [
    job({ id: 'a', section: 'daily', targetId: 'package' }),
    job({ id: 'b', section: 'more' }),
    job({ id: 'c', section: 'tool' }),
  ];
  assert.equal(buildCheckRows(jobs, 'daily', labels).length, 1);
  assert.equal(buildCheckRows(jobs, 'more', labels).length, 1);
  assert.equal(buildCheckRows(jobs, 'tool', labels).length, 1);
});

test('대상 이름을 모르면 잡 이름으로 대신함', () => {
  const [row] = buildCheckRows(
    [job({ id: 'z', label: '어떤 체크', section: 'daily', targetId: 'unknown' })],
    'daily',
    labels,
  );
  assert.equal(row.label, '어떤 체크');
});
