import assert from 'node:assert/strict';
import {
  buildCafeExposureRow,
  matchCafeTargets,
} from '../lib/cafe-exposure-check';
import { extractPopularItems } from '../parser';

const sampleHtml = `
<div class="fds-ugc-single-intention-item-list">
  <div data-template-id="ugcItem">
    <a
      href="/p/crd/rd?u=https%3A%2F%2Fcafe.naver.com%2Fshopjirmsin%2F11091063"
      cru="https://cafe.naver.com/shopjirmsin/11091063"
      data-heatmap-target=".link"
    >
      <span class="sds-comps-text-type-headline1">흑염소탕효능 부모님께 좋나요</span>
    </a>
    <div class="sds-comps-profile-info-title-text">
      <a href="https://cafe.naver.com/shopjirmsin">쇼핑지름신 (구매대행, 공동구매)</a>
    </div>
    <div class="sds-comps-text-type-body1">카페 글 요약</div>
  </div>
</div>
`;

const blogOnlyItems = extractPopularItems(sampleHtml);
assert.equal(blogOnlyItems.length, 0);

const cafeIncludedItems = extractPopularItems(sampleHtml, { includeCafe: true });
assert.equal(cafeIncludedItems.length, 1);
assert.equal(
  cafeIncludedItems[0]?.link,
  'https://cafe.naver.com/shopjirmsin/11091063'
);
assert.equal(cafeIncludedItems[0]?.sourceType, 'cafe');
assert.equal(cafeIncludedItems[0]?.sourceId, 'shopjirmsin');

const nameMatches = matchCafeTargets(cafeIncludedItems, [{ name: '쇼핑지름신' }]);
assert.equal(nameMatches.length, 1);
assert.equal(nameMatches[0]?.matchedBy, 'name');

const idMatches = matchCafeTargets(cafeIncludedItems, [
  { name: '다른 카페', ids: ['shopjirmsin'] },
]);
assert.equal(idMatches.length, 1);
assert.equal(idMatches[0]?.matchedBy, 'id');

const row = buildCafeExposureRow('흑염소탕효능', nameMatches);
assert.equal(row.exposureStatus, '노출');
assert.equal(row.cafeName, '쇼핑지름신 (구매대행, 공동구매)');
assert.equal(row.link, 'https://cafe.naver.com/shopjirmsin/11091063');

process.stdout.write('cafe exposure check tests passed\n');
