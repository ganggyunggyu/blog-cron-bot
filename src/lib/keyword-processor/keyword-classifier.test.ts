import assert from 'node:assert/strict';
import { getVendorTarget } from './keyword-classifier';

const rootKeyword = {
  company: '아키아키',
  sheetType: 'root',
};

assert.equal(getVendorTarget(rootKeyword, '아키아키'), '아키아키');
assert.equal(getVendorTarget(rootKeyword, '아키아키', true), '');

console.log('keyword-classifier tests passed');
