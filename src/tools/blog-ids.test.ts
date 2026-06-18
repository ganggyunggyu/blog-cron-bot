import assert from 'node:assert/strict';
import {
  ALIBABA_BLOG_IDS,
  ALIBABA_BLOG_IDS_BY_SECTION,
  ALIBABA_SECTION_NAMES,
  BLOG_IDS,
  DOGMARU_BLOG_IDS,
  DOGMARU_PAGE_CHECK_BLOG_IDS,
  EXCLUDED_BLOG_IDS,
  PAGE_CHECK_BLOG_IDS_BY_SHEET_TYPE,
  PAGES_BLOG_IDS,
  PET_PAGE_CHECK_BLOG_IDS,
  SURI_PET_BLOG_IDS,
  SURI_PET_PAGE_CHECK_BLOG_IDS,
} from '../constants/blog-ids';

const REQUIRED_DOGMARU_BLOG_IDS = ['mw_mj', 'janaggena', 'wandookong2'];

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

assert.equal(ALIBABA_BLOG_IDS.length, 13);
assert.equal(new Set(ALIBABA_BLOG_IDS).size, ALIBABA_BLOG_IDS.length);

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
