import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { parsePreset, type TenantPreset } from './preset';
import { parseNaverTargetInputs } from './naver-target-input';
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
  targets: ['https://cafe.naver.com/localtable702', 'https://blog.naver.com/higher_0'],
  ...over,
});

test('카페 체크를 저장하고 다시 읽음', () => {
  const preset = parsePreset(base([check()]));
  assert.equal(preset.cafeChecks?.length, 1);
  assert.equal(preset.cafeChecks?.[0].targets.length, 2);
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
    [[check({ targets: [] })], /1개 이상/],
    [[check({ targets: ['a', 'a'] })], /여러 번/],
    // 환경변수로 쉼표 이어붙여 넘기므로 값에 쉼표가 있으면 두 개로 쪼개진다.
    [[check({ targets: ['가, 나'] })], /쉼표/],
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

test('시트와 대상을 환경변수로 넘김', () => {
  const env = buildCafeCheckEnv(check());
  assert.equal(env.CAFE_SOURCE_SHEET_URL, SHEET);
  assert.equal(env.CAFE_SOURCE_SHEET_NAME, '카페키워드');
  assert.equal(env.CAFE_SHEET_NAME, '카페키워드');
  // 주소를 보고 카페와 블로그가 알아서 갈린다.
  assert.equal(env.CAFE_TARGET_IDS, 'localtable702');
  assert.equal(env.BLOG_TARGET_IDS, 'higher_0');
  // 이름 매칭은 부분 문자열까지 맞다고 봐서 오탐을 만든다. 비워둔다.
  assert.equal(env.CAFE_TARGET_NAMES, '');
  // 읽는 시트와 쓰는 시트가 둘 다 사용자가 지정한 곳이어야 한다.
  //
  // 비워두면 안 된다. 자식 프로세스가 루트 .env의 CAFE_SOURCE_SHEET_ID를 물려받고,
  // check-cafe-exposure.ts가 URL보다 그 값을 먼저 쓴다. 결과 시트도 비우면
  // 하드코딩된 기본 시트로 써버린다. 둘 다 실제로 겪은 일이다.
  const sheetId = '1AbC_dEf-123';
  assert.equal(env.CAFE_SOURCE_SHEET_ID, sheetId, '읽는 시트가 사용자 것이어야 함');
  assert.equal(env.CAFE_SHEET_ID, sheetId, '쓰는 시트도 사용자 것이어야 함');
  // gid는 비운다. .env에 남은 기본 시트 gid가 섞이면 엉뚱한 탭을 읽는다.
  assert.equal(env.CAFE_SOURCE_SHEET_GID, '');
  assert.equal(env.CAFE_SHEET_GID, '');
});

/** 봇과 대시보드가 같은 판정을 해야 화면 개수와 실제 확인 대상이 안 어긋난다. */
test('주소 판정 기준이 봇과 같음', () => {
  const casesPath = path.join(
    __dirname,
    '../../../src/lib/naver-target-input/cases.json',
  );
  const { cases } = JSON.parse(fs.readFileSync(casesPath, 'utf-8')) as {
    cases: { line: string; cafeIds: string[]; blogIds: string[]; why: string }[];
  };
  assert.ok(cases.length > 0, '기준 목록이 비어 있으면 안 됨');
  cases.forEach(({ line, cafeIds, blogIds, why }) => {
    const result = parseNaverTargetInputs([line]);
    assert.deepEqual(result.cafeIds, cafeIds, `카페(${why}): ${line}`);
    assert.deepEqual(result.blogIds, blogIds, `블로그(${why}): ${line}`);
  });
});
