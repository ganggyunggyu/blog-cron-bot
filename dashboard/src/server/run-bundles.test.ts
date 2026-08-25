import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePreset, type PresetTarget, type TenantPreset } from './preset';
import { resolveRunBundles } from './member-jobs';

const target = (id: string, enabled = true): PresetTarget => ({
  id,
  label: id,
  kind: 'basic',
  source: { sheetId: 'sheet-1', tabTitle: '탭' },
  enabled,
});

const basePreset = (bundles: unknown) => ({
  targets: [target('package'), target('pet'), target('cafe')],
  blogGroups: [],
  runBundles: bundles,
});

test('실행 묶음을 저장하고 다시 읽음', () => {
  const preset = parsePreset(
    basePreset([
      { id: 'b1', label: '아침 전체', targets: ['package', 'pet'], maxPages: 3 },
      { id: 'b2', label: '카페만', targets: ['cafe'] },
    ]),
  );
  assert.equal(preset.runBundles?.length, 2);
  assert.deepEqual(preset.runBundles?.[0], {
    id: 'b1',
    label: '아침 전체',
    targets: ['package', 'pet'],
    maxPages: 3,
  });
  // 페이지 수를 안 정하면 키 자체를 남기지 않는다. 기본값을 쓴다는 뜻이다.
  assert.equal('maxPages' in (preset.runBundles?.[1] ?? {}), false);
});

test('묶음이 없으면 키를 만들지 않음', () => {
  assert.equal(parsePreset(basePreset(undefined)).runBundles, undefined);
  assert.equal(parsePreset(basePreset([])).runBundles, undefined);
});

test('잘못된 묶음은 저장을 거부함', () => {
  const invalid: [unknown, RegExp][] = [
    [[{ id: '', label: 'x', targets: ['pet'] }], /id가 비어 있음/],
    [[{ id: 'b1', label: '  ', targets: ['pet'] }], /이름이 비어 있음/],
    [[{ id: 'b1', label: 'x', targets: [] }], /1개 이상/],
    [[{ id: 'b1', label: 'x', targets: ['pet', 'pet'] }], /여러 번/],
    [[{ id: 'b1', label: 'x', targets: ['없는대상'] }], /이 계정에 없는 대상/],
    [
      [
        { id: 'b1', label: 'x', targets: ['pet'] },
        { id: 'b1', label: 'y', targets: ['cafe'] },
      ],
      /중복됨/,
    ],
    [[{ id: 'b1', label: 'x', targets: ['pet'], maxPages: 0 }], /1~9/],
    [[{ id: 'b1', label: 'x', targets: ['pet'], maxPages: 10 }], /1~9/],
    [{ nope: true }, /배열이 아님/],
  ];
  invalid.forEach(([bundles, pattern]) => {
    assert.throws(() => parsePreset(basePreset(bundles)), pattern);
  });
});

/**
 * 묶음을 만든 뒤 대상을 끄는 건 흔하다. 그때 버튼이 400을 뱉는 대신, 꺼진 대상만
 * 빠지고 무엇이 빠졌는지 보여야 한다.
 */
test('꺼둔 대상은 묶음에서 빠지고 무엇이 빠졌는지 알려줌', () => {
  const preset: TenantPreset = {
    targets: [target('package'), target('pet', false), target('cafe')],
    blogGroups: [],
    runBundles: [
      { id: 'b1', label: '아침', targets: ['package', 'pet'] },
      { id: 'b2', label: '애견만', targets: ['pet'] },
    ],
  };
  const [morning, petOnly] = resolveRunBundles(preset);

  assert.deepEqual(morning.targets, ['package']);
  assert.deepEqual(morning.droppedTargets, ['pet']);

  // 전부 꺼진 묶음은 사라지지 않고 빈 상태로 남는다. 사라지면 왜 없어졌는지 모른다.
  assert.deepEqual(petOnly.targets, []);
  assert.deepEqual(petOnly.droppedTargets, ['pet']);
});

test('묶음이 없는 프리셋은 빈 목록을 냄', () => {
  assert.deepEqual(
    resolveRunBundles({ targets: [target('pet')], blogGroups: [] }),
    [],
  );
});
