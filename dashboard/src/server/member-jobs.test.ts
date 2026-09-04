import assert from 'node:assert/strict';
import test from 'node:test';
import { JOB_REGISTRY } from './job-registry';
import {
  JOB_REQUIRED_TARGETS,
  buildCafeCheckEnv,
  canMemberRunJob,
  getEnabledTargetIds,
  getJobsForPreset,
  getSuiteTargetIdsForPreset,
} from './member-jobs';
import { EMPTY_PRESET, type TenantPreset, type CafeCheck } from './preset';

const target = (id: string, enabled = true) => ({
  id,
  label: id,
  kind: 'basic' as const,
  source: { sheetId: 's', tabTitle: 't' },
  enabled,
});

const presetWith = (ids: string[]): TenantPreset => ({
  targets: ids.map((id) => target(id)),
  blogGroups: [],
});

/**
 * 이 테스트가 이 파일에서 제일 중요하다. 매핑에 없는 잡은 아무에게도 안 보이므로,
 * 잡을 추가하면서 매핑을 빠뜨리면 화면에서 조용히 사라진다.
 */
test('모든 실행 항목에 필요한 대상이 정의돼 있음', () => {
  const missing = JOB_REGISTRY.filter(({ id }) => !JOB_REQUIRED_TARGETS[id]).map(
    ({ id }) => id,
  );
  assert.deepEqual(missing, [], `매핑이 빠진 항목: ${missing.join(', ')}`);
});

test('매핑에 레지스트리에 없는 항목이 남아 있지 않음', () => {
  const registryIds = new Set(JOB_REGISTRY.map(({ id }) => id));
  const stale = Object.keys(JOB_REQUIRED_TARGETS).filter(
    (id) => !registryIds.has(id),
  );
  assert.deepEqual(stale, [], `없어진 항목이 매핑에 남음: ${stale.join(', ')}`);
});

test('빈 프리셋은 아무것도 못 돌림', () => {
  assert.deepEqual(getJobsForPreset(EMPTY_PRESET), []);
  assert.deepEqual(getSuiteTargetIdsForPreset(EMPTY_PRESET), []);
  assert.equal(canMemberRunJob(EMPTY_PRESET, 'exposure-suite'), false);
  assert.equal(canMemberRunJob(EMPTY_PRESET, 'package-exposure'), false);
});

test('켠 대상에 해당하는 항목만 돌릴 수 있음', () => {
  const preset = presetWith(['pet']);
  assert.equal(canMemberRunJob(preset, 'pet-exposure'), true);
  assert.equal(canMemberRunJob(preset, 'pet-exposure-9-direct'), true);
  assert.equal(canMemberRunJob(preset, 'suripet-exposure'), false);
  assert.equal(canMemberRunJob(preset, 'cafe-exposure'), false);
  // 전체 실행은 7개 중 하나라도 있으면 보이되, 대상은 켠 것만이다.
  assert.equal(canMemberRunJob(preset, 'exposure-suite'), true);
  assert.deepEqual(getSuiteTargetIdsForPreset(preset), ['pet']);
});

test('꺼둔 대상은 켜지 않은 것과 같음', () => {
  const preset: TenantPreset = {
    targets: [target('pet', false), target('cafe', true)],
    blogGroups: [],
  };
  assert.deepEqual(Array.from(getEnabledTargetIds(preset)), ['cafe']);
  assert.equal(canMemberRunJob(preset, 'pet-exposure'), false);
  assert.equal(canMemberRunJob(preset, 'cafe-exposure'), true);
  assert.deepEqual(getSuiteTargetIdsForPreset(preset), ['cafe']);
});

test('더보기 묶음은 세 대상 중 하나만 있어도 보임', () => {
  assert.equal(
    canMemberRunJob(presetWith(['general-more']), 'package-general-dogmaru-more-exposure'),
    true,
  );
  assert.equal(
    canMemberRunJob(presetWith(['root-more']), 'package-general-dogmaru-more-exposure'),
    false,
  );
  assert.equal(canMemberRunJob(presetWith(['root-more']), 'root-more-exposure'), true);
});

test('카페 URL 체크는 루트 대상이 있어야 보임', () => {
  assert.equal(canMemberRunJob(presetWith(['root']), 'root-cafe-url-exposure'), true);
  assert.equal(canMemberRunJob(presetWith(['cafe']), 'root-cafe-url-exposure'), false);
});

test('카페 체크 실행env는 사용자가 지정한 시트를 결과 저장 대상으로도 씀', () => {
  const check: CafeCheck = {
    id: 'c1',
    label: '테스트 카페 노출',
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0/edit#gid=123',
    tabTitle: '테스트카페키워드',
    targets: ['https://cafe.naver.com/localtable702', 'https://blog.naver.com/higher_0'],
  };
  const env = buildCafeCheckEnv(check);
  // 결과 시트가 소스 시트와 다른 곳(하드코딩된 기본 시트)으로 새는 걸 막는다.
  assert.equal(env.CAFE_SHEET_ID, '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0');
  // 소스도 마찬가지다. .env의 CAFE_SOURCE_SHEET_ID가 먼저 채워져 있으면
  // getSourceSheetConfig()가 URL 파싱보다 그 값을 우선 쓰므로, 비워두면 안 된다.
  assert.equal(env.CAFE_SOURCE_SHEET_ID, '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0');
  assert.equal(env.CAFE_SOURCE_SHEET_URL, check.sheetUrl);
  assert.equal(env.CAFE_SHEET_NAME, '테스트카페키워드');
  assert.equal(env.CAFE_TARGET_IDS, 'localtable702');
  assert.equal(env.BLOG_TARGET_IDS, 'higher_0');
});

test('21lab 프리셋 모양이면 지금 쓰는 항목이 전부 보임', () => {
  const preset = presetWith([
    'package', 'general', 'dogmaru', 'root', 'pet', 'suripet', 'cafe',
    'package-more', 'general-more', 'dogmaru-more', 'root-more',
  ]);
  const ids = getJobsForPreset(preset).map(({ id }) => id);
  [
    'exposure-suite',
    'package-exposure',
    'root-exposure',
    'pet-exposure',
    'pet-exposure-9-direct',
    'suripet-exposure',
    'cafe-exposure',
    'root-cafe-url-exposure',
    'package-general-dogmaru-more-exposure',
    'root-more-exposure',
  ].forEach((id) => assert.ok(ids.includes(id), `${id} 가 보여야 함`));
  assert.equal(getSuiteTargetIdsForPreset(preset).length, 7);
});
