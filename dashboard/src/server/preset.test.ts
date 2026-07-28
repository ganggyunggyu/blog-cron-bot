import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_PRESET, parsePreset } from './preset';

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
