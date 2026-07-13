import assert from 'node:assert/strict';
import {
  ALIBABA_BLOG_IDS,
  ALIBABA_BLOG_IDS_BY_SECTION,
  ALIBABA_SECTION_NAMES,
  BLOG_IDS,
  DOGMARU_BLOG_IDS,
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  EXCLUDED_BLOG_IDS,
  PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
  PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE,
  PAGES_BLOG_IDS,
  PET_PAGE_CHECK_BLOG_IDS,
  SURI_PET_BLOG_IDS,
  SURI_PET_PAGE_CHECK_BLOG_IDS,
} from '../constants/blog-ids';

const REQUIRED_DOGMARU_BLOG_IDS = [
  'mw_mj',
  'janaggena',
  'wandookong2',
  'mirca1004',
  'dudtjsdh159',
  'yaboo_171022',
  'artistjunga',
];
const REQUIRED_SURI_PET_BLOG_IDS = ['pjwon03'];
const REQUIRED_ALIBABA_BLOG_IDS = ['introsm'];
const REQUIRED_BASE_BLOG_IDS = ['introsm'];
const REQUIRED_REACTIVATED_BLOG_IDS = ['durysuk'];
const DOGMARU_PAGE_CHECK_ONLY_EXCLUDED_BLOG_IDS = ['sghjan'];
const REQUIRED_PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS = [
  '0902ab',
  'by9996',
  'ziniz77',
  'taraswati',
  'vividoasis',
  'yaves0218',
  'idoenzang',
  'an970405',
  'hotelelena',
  'yakooroo',
  'sssunz',
  'canopus_72',
  'queen9336',
  'sesrsoa',
  'umle1203',
  'minjin90310',
  'mw_mj',
  'jkr1231',
  'jini79_kr',
  'sweetfam',
  'kwen1030',
  'k54382000',
  'janaggena',
  'wandookong2',
  'hwre7774',
  'mirca1004',
  'surreal805',
  'tpeany',
  'ikc9036',
  'nanugi99',
  'v3se',
  'i_thinkkkk',
  'sunyzone2',
  'kgshon',
  'olpark4455',
  'ylk3516',
  'managa7766',
  'ps8868',
  'introsm',
  'durysuk',
  'armour00',
  'solantoro',
  'busansmart',
  'dnation09',
  'dreamclock33',
  'sarangchai_',
  'sw078',
  'seowoo7603',
  'sanghoonchoi',
  'zizi923',
];

const assertContainsAll = (targetBlogIds: string[], expectedBlogIds: string[]) => {
  for (const expectedBlogId of expectedBlogIds) {
    assert.equal(
      targetBlogIds.includes(expectedBlogId),
      true,
      `missing blog id: ${expectedBlogId}`
    );
  }
};

const assertExcludesAll = (targetBlogIds: string[], excludedBlogIds: readonly string[]) => {
  for (const excludedBlogId of excludedBlogIds) {
    assert.equal(
      targetBlogIds.includes(excludedBlogId),
      false,
      `excluded blog id still present: ${excludedBlogId}`
    );
  }
};

assertContainsAll(DOGMARU_BLOG_IDS, REQUIRED_DOGMARU_BLOG_IDS);
assertContainsAll(DOGMARU_PAGE_CHECK_BLOG_IDS, REQUIRED_DOGMARU_BLOG_IDS);
assertContainsAll(SURI_PET_BLOG_IDS, REQUIRED_SURI_PET_BLOG_IDS);
assertContainsAll(SURI_PET_PAGE_CHECK_BLOG_IDS, REQUIRED_SURI_PET_BLOG_IDS);
assertContainsAll(PET_PAGE_CHECK_BLOG_IDS, REQUIRED_SURI_PET_BLOG_IDS);
assertContainsAll(BLOG_IDS, REQUIRED_BASE_BLOG_IDS);
assertContainsAll(BLOG_IDS, REQUIRED_REACTIVATED_BLOG_IDS);
assertContainsAll(BLOG_IDS, DOGMARU_PAGE_CHECK_ONLY_EXCLUDED_BLOG_IDS);
assertExcludesAll(
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  DOGMARU_PAGE_CHECK_ONLY_EXCLUDED_BLOG_IDS
);
assertContainsAll(
  PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS,
  REQUIRED_PACKAGE_GENERAL_MORE_CHECK_BLOG_IDS
);
assertContainsAll(PAGES_BLOG_IDS, REQUIRED_BASE_BLOG_IDS);
assertContainsAll(DOGMARU_PAGE_CHECK_BLOG_IDS, REQUIRED_BASE_BLOG_IDS);
assertContainsAll(DOGMARU_PAGE_CHECK_BLOG_IDS, REQUIRED_REACTIVATED_BLOG_IDS);
assertContainsAll(PET_PAGE_CHECK_BLOG_IDS, REQUIRED_BASE_BLOG_IDS);
assertContainsAll(PET_PAGE_CHECK_BLOG_IDS, REQUIRED_REACTIVATED_BLOG_IDS);
assertContainsAll(SURI_PET_PAGE_CHECK_BLOG_IDS, REQUIRED_BASE_BLOG_IDS);
assertContainsAll(SURI_PET_PAGE_CHECK_BLOG_IDS, REQUIRED_REACTIVATED_BLOG_IDS);

assert.equal(ALIBABA_BLOG_IDS.length, 14);
assert.equal(new Set(ALIBABA_BLOG_IDS).size, ALIBABA_BLOG_IDS.length);
assertContainsAll(ALIBABA_BLOG_IDS, REQUIRED_ALIBABA_BLOG_IDS);

for (const sectionName of ALIBABA_SECTION_NAMES) {
  assert.deepEqual(
    ALIBABA_BLOG_IDS_BY_SECTION[sectionName],
    ALIBABA_BLOG_IDS,
    `${sectionName} should check all Alibaba blog ids`
  );
}

assertContainsAll(SURI_PET_PAGE_CHECK_BLOG_IDS, BLOG_IDS);
assertContainsAll(SURI_PET_PAGE_CHECK_BLOG_IDS, SURI_PET_BLOG_IDS);
assert.deepEqual(
  PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE.suripet,
  SURI_PET_PAGE_CHECK_BLOG_IDS
);
assert.equal(
  new Set(SURI_PET_PAGE_CHECK_BLOG_IDS).size,
  SURI_PET_PAGE_CHECK_BLOG_IDS.length
);

assertExcludesAll(BLOG_IDS, EXCLUDED_BLOG_IDS);
assertExcludesAll(PAGES_BLOG_IDS, EXCLUDED_BLOG_IDS);
assertExcludesAll(DOGMARU_BLOG_IDS, EXCLUDED_BLOG_IDS);
assertExcludesAll(DOGMARU_PAGE_CHECK_BLOG_IDS, EXCLUDED_BLOG_IDS);
assertExcludesAll(PET_PAGE_CHECK_BLOG_IDS, EXCLUDED_BLOG_IDS);
assertExcludesAll(SURI_PET_BLOG_IDS, EXCLUDED_BLOG_IDS);
assertExcludesAll(SURI_PET_PAGE_CHECK_BLOG_IDS, EXCLUDED_BLOG_IDS);

for (const targetBlogIds of Object.values(PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE)) {
  assertExcludesAll(targetBlogIds, EXCLUDED_BLOG_IDS);
}

process.stdout.write('blog ids tests passed\n');
