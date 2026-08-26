import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePreset, type TenantPreset } from './preset';
import {
  buildCafeCheckEnv,
  buildCafeCheckJobs,
  canMemberRunJob,
  findCafeCheck,
  getJobsForPreset,
} from './member-jobs';

const SHEET = 'https://docs.google.com/spreadsheets/d/1AbC_dEf-123/edit#gid=0';

const base = (checks: unknown) => ({
  targets: [
    {
      id: 'cafe',
      label: '카페 + 블로그',
      kind: 'basic',
      source: { sheetId: 's', tabTitle: 't' },
      enabled: true,
    },
  ],
  blogGroups: [],
  cafeChecks: checks,
});

const check = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  label: '내 카페',
  sheetUrl: SHEET,
  tabTitle: '카페키워드',
  cafeNames: ['쇼핑지름신', '샤넬오픈런'],
  ...over,
});

test('카페 체크를 저장하고 다시 읽음', () => {
  const preset = parsePreset(base([check()]));
  assert.equal(preset.cafeChecks?.length, 1);
  assert.deepEqual(preset.cafeChecks?.[0].cafeNames, ['쇼핑지름신', '샤넬오픈런']);
});

test('없으면 키를 만들지 않음', () => {
  assert.equal(parsePreset(base(undefined)).cafeChecks, undefined);
  assert.equal(parsePreset(base([])).cafeChecks, undefined);
});

test('잘못된 카페 체크는 저장을 거부함', () => {
  const invalid: [unknown, RegExp][] = [
    [[check({ label: '  ' })], /이름이 비어 있음/],
    [[check({ sheetUrl: 'https://example.com/nope' })], /구글시트 주소가 아님/],
    [[check({ tabTitle: '' })], /탭 이름이 비어 있음/],
    [[check({ cafeNames: [] })], /1개 이상/],
    [[check({ cafeNames: ['a', 'a'] })], /여러 번/],
    // 환경변수로 쉼표 이어붙여 넘기므로 이름에 쉼표가 있으면 두 개로 쪼개진다.
    [[check({ cafeNames: ['가, 나'] })], /쉼표/],
    [[check(), check()], /중복됨/],
    [{ nope: 1 }, /배열이 아님/],
  ];
  invalid.forEach(([value, pattern]) => {
    assert.throws(() => parsePreset(base(value)), pattern);
  });
});

test('실행 항목으로 나오고 그 회원만 돌릴 수 있음', () => {
  const preset = parsePreset(base([check()])) as TenantPreset;
  const jobs = buildCafeCheckJobs(preset);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'cafe-check:c1');
  assert.equal(jobs[0].label, '내 카페');
  assert.equal(jobs[0].script, 'cafe:check');

  assert.equal(canMemberRunJob(preset, 'cafe-check:c1'), true);
  // 남의 체크 id를 직접 불러도 통과하면 안 된다.
  assert.equal(canMemberRunJob(preset, 'cafe-check:없는거'), false);
  assert.equal(findCafeCheck(preset, 'cafe-check:없는거'), undefined);

  assert.ok(
    getJobsForPreset(preset).some(({ id }) => id === 'cafe-check:c1'),
    '목록에 붙어야 함',
  );
});

test('시트와 카페를 환경변수로 넘김', () => {
  const env = buildCafeCheckEnv(check());
  assert.equal(env.CAFE_SOURCE_SHEET_URL, SHEET);
  assert.equal(env.CAFE_SOURCE_SHEET_NAME, '카페키워드');
  assert.equal(env.CAFE_SHEET_NAME, '카페키워드');
  assert.equal(env.CAFE_TARGET_NAMES, '쇼핑지름신,샤넬오픈런');
  // .env에 남아 있는 기본 시트 gid가 새 시트에 섞이면 엉뚱한 탭을 읽는다.
  assert.equal(env.CAFE_SOURCE_SHEET_GID, '');
  assert.equal(env.CAFE_SHEET_GID, '');
  assert.equal(env.CAFE_SHEET_ID, '');
});
