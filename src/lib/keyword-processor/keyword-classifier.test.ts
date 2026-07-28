import assert from 'node:assert/strict';
import { getMatchVendorTarget } from './keyword-classifier';

const rootKeyword = {
  _id: 'root-keyword',
  company: '아키아키',
  keyword: '청주맛집(아키아키)',
};

assert.equal(getMatchVendorTarget(rootKeyword, '아키아키', false), '아키아키');
assert.equal(getMatchVendorTarget(rootKeyword, '아키아키', true), '');

process.stdout.write('keyword classifier tests passed\n');
