import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_PRESET, parsePreset, resolveTargetBlogIds } from './preset';

const validTarget = {
  id: 'package',
  label: '패키지',
  kind: 'basic',
  source: { sheetId: 'sheet-a', tabTitle: '패키지' },
  result: { sheetId: 'sheet-b', tabTitle: '패키지결과' },
  enabled: true,
};

test('읽기/쓰기 시트와 종류가 갖춰진 대상을 통과시킴', () => {
  const preset = parsePreset({
    targets: [validTarget],
    doorayWebhookUrl: 'https://hook.dooray.com/services/1/2/3',
  });

  assert.equal(preset.targets.length, 1);
  assert.equal(preset.targets[0]?.source.tabTitle, '패키지');
  assert.equal(preset.targets[0]?.result?.sheetId, 'sheet-b');
  assert.equal(preset.doorayWebhookUrl, 'https://hook.dooray.com/services/1/2/3');
});

test('쓰기 시트를 비우면 원본 시트에 반영하는 대상으로 둠', () => {
  const preset = parsePreset({
    targets: [{ ...validTarget, result: { sheetId: '', tabTitle: '' } }],
  });

  assert.equal(preset.targets[0]?.result, undefined);
});

test('값 없는 optional 필드는 키 자체를 남기지 않음', () => {
  // undefined로 남기면 MongoDB가 null로 저장해서, 읽는 쪽이 설정된 값으로 착각한다.
  const [target] = parsePreset({
    targets: [{ ...validTarget, result: null, maxPages: null, blogIds: null }],
  }).targets;

  assert.equal('result' in target!, false);
  assert.equal('maxPages' in target!, false);
  assert.equal('blogIds' in target!, false);
});

test('Dooray 웹훅이 없으면 키를 남기지 않음', () => {
  const preset = parsePreset({ targets: [] });

  assert.equal('doorayWebhookUrl' in preset, false);
});

test('페이지 노출체크는 1~10 페이지만 받음', () => {
  const preset = parsePreset({
    targets: [{ ...validTarget, kind: 'page', maxPages: 4 }],
  });
  assert.equal(preset.targets[0]?.maxPages, 4);

  assert.throws(
    () => parsePreset({ targets: [{ ...validTarget, kind: 'page', maxPages: 0 }] }),
    /1~10/,
  );
  assert.throws(
    () => parsePreset({ targets: [{ ...validTarget, kind: 'page', maxPages: 11 }] }),
    /1~10/,
  );
});

test('페이지 노출체크가 아니면 페이지 수를 버림', () => {
  const preset = parsePreset({
    targets: [{ ...validTarget, kind: 'basic', maxPages: 4 }],
  });

  assert.equal(preset.targets[0]?.maxPages, undefined);
});

test('읽기 시트가 비어 있으면 거부함', () => {
  assert.throws(
    () =>
      parsePreset({
        targets: [{ ...validTarget, source: { sheetId: '', tabTitle: '패키지' } }],
      }),
    /읽기 시트/,
  );
  assert.throws(
    () =>
      parsePreset({
        targets: [{ ...validTarget, source: { sheetId: 'sheet-a', tabTitle: ' ' } }],
      }),
    /읽기 탭/,
  );
});

test('노출체크 종류가 기본/더보기/페이지가 아니면 거부함', () => {
  assert.throws(
    () => parsePreset({ targets: [{ ...validTarget, kind: 'popular' }] }),
    /노출체크 종류/,
  );
});

test('대상 id가 겹치면 거부함', () => {
  assert.throws(
    () => parsePreset({ targets: [validTarget, { ...validTarget, label: '중복' }] }),
    /중복/,
  );
});

test('블로그 계정 목록은 공백을 정리하고 중복을 지움', () => {
  const preset = parsePreset({
    targets: [{ ...validTarget, blogIds: [' introsm ', 'introsm', '', 'airtrd'] }],
  });

  assert.deepEqual(preset.targets[0]?.blogIds, ['introsm', 'airtrd']);
});

test('Dooray 웹훅은 https만 받음', () => {
  assert.throws(
    () => parsePreset({ targets: [], doorayWebhookUrl: 'http://hook.dooray.com/x' }),
    /https/,
  );
  assert.equal(parsePreset({ targets: [], doorayWebhookUrl: '  ' }).doorayWebhookUrl, undefined);
});

test('대상 목록이 배열이 아니면 거부함', () => {
  assert.throws(() => parsePreset({ targets: 'package' }), /대상 목록/);
  assert.throws(() => parsePreset(null), /대상 목록/);
});

test('빈 프리셋은 대상 없이 통과함', () => {
  assert.deepEqual(parsePreset(EMPTY_PRESET), EMPTY_PRESET);
});

const JOONCHOI = { id: 'joonchoi', label: '준최', blogIds: ['introsm', 'airtrd'] };
const CHOIBLOG = { id: 'choiblog', label: '최블', blogIds: ['tpeany', 'airtrd'] };

test('대상이 계정 그룹 여러 개를 더해서 씀', () => {
  const preset = parsePreset({
    blogGroups: [JOONCHOI, CHOIBLOG],
    targets: [{ ...validTarget, blogGroupIds: ['joonchoi', 'choiblog'] }],
  });

  // 준최 + 최블 합집합. 겹치는 airtrd는 한 번만 나온다.
  assert.deepEqual(resolveTargetBlogIds(preset, preset.targets[0]!), [
    'introsm',
    'airtrd',
    'tpeany',
  ]);
});

test('그룹과 직접 계정을 같이 쓰면 둘 다 합침', () => {
  const preset = parsePreset({
    blogGroups: [JOONCHOI],
    targets: [
      { ...validTarget, blogGroupIds: ['joonchoi'], blogIds: ['ylk3516'] },
    ],
  });

  assert.deepEqual(resolveTargetBlogIds(preset, preset.targets[0]!), [
    'introsm',
    'airtrd',
    'ylk3516',
  ]);
});

test('그룹도 직접 계정도 없으면 전체 계정을 뜻하는 빈 목록임', () => {
  const preset = parsePreset({ blogGroups: [JOONCHOI], targets: [validTarget] });

  assert.deepEqual(resolveTargetBlogIds(preset, preset.targets[0]!), []);
});

test('없는 계정 그룹을 가리키면 거부함', () => {
  // 통과시키면 그 대상만 조용히 계정 0개로 돌아 노출 0건으로 보인다.
  assert.throws(
    () =>
      parsePreset({
        blogGroups: [JOONCHOI],
        targets: [{ ...validTarget, blogGroupIds: ['choiblog'] }],
      }),
    /계정 그룹 "choiblog"가 없음/,
  );
});

test('계정 그룹 id가 겹치면 거부함', () => {
  assert.throws(
    () =>
      parsePreset({
        blogGroups: [JOONCHOI, { ...JOONCHOI, label: '준최 복사' }],
        targets: [],
      }),
    /계정 그룹 id "joonchoi"가 중복됨/,
  );
});

test('그룹의 블로그 ID는 URL을 붙여넣어도 받아주고 정리함', () => {
  const preset = parsePreset({
    blogGroups: [
      {
        id: 'joonchoi',
        label: '준최',
        blogIds: [
          'https://blog.naver.com/introsm',
          ' INTROSM ',
          'm.blog.naver.com/airtrd?fromRss=true',
          '!!',
        ],
      },
    ],
    targets: [],
  });

  assert.deepEqual(preset.blogGroups[0]?.blogIds, ['introsm', 'airtrd']);
});

test('계정 그룹이 없던 옛 프리셋도 그대로 통과함', () => {
  const preset = parsePreset({ targets: [validTarget] });

  assert.deepEqual(preset.blogGroups, []);
});

test('그룹을 안 고른 대상은 blogGroupIds 키를 남기지 않음', () => {
  const [target] = parsePreset({
    blogGroups: [JOONCHOI],
    targets: [{ ...validTarget, blogGroupIds: [] }],
  }).targets;

  assert.equal('blogGroupIds' in target!, false);
});
